const crypto = require('crypto');
const db = require('../config/db');
const csvParser = require('../parsers/csvParser');
const importRepository = require('../repositories/importRepository');
const accountRepository = require('../repositories/accountRepository');
const categoryRepository = require('../repositories/categoryRepository');
const ruleService = require('./ruleService');
const AppError = require('../utils/AppError');

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const MAX_ROWS = 1000;

/**
 * Tính mã SHA-256 hash của chuỗi nội dung file
 */
const computeFileHash = (content = '') => {
    return crypto.createHash('sha256').update(String(content || '').trim()).digest('hex');
};

/**
 * Tính mã SHA-256 hash của một dòng dữ liệu giao dịch
 */
const computeRowHash = (accountId, date, amount, type, note) => {
    const raw = `${accountId}|${date}|${amount}|${type}|${String(note || '').trim().toLowerCase()}`;
    return crypto.createHash('sha256').update(raw).digest('hex');
};

/**
 * Xem trước và kiểm tra tính hợp lệ của file CSV sao kê (Dry-run Preview - SPEC 4.5)
 * Tuyệt đối không ghi dữ liệu vào CSDL ở bước này.
 */
const previewCsv = async (payload = {}) => {
    const {
        file_name = 'statement.csv',
        file_content = '',
        account_id,
        column_mapping = null
    } = payload;

    if (!file_content || typeof file_content !== 'string') {
        throw new AppError('Nội dung file CSV không hợp lệ hoặc rỗng.', 400);
    }

    if (Buffer.byteLength(file_content, 'utf8') > MAX_FILE_SIZE) {
        throw new AppError('Dung lượng file CSV vượt quá giới hạn tối đa cho phép (5MB).', 400);
    }

    const numAccountId = Number(account_id);
    if (!Number.isSafeInteger(numAccountId) || numAccountId <= 0) {
        throw new AppError('Vui lòng chọn ví nguồn hợp lệ để nhập sao kê.', 400);
    }

    const account = await accountRepository.findById(numAccountId);
    if (!account) {
        throw new AppError('Ví được chọn không tồn tại.', 404);
    }
    if (account.is_archived) {
        throw new AppError('Không thể nhập sao kê vào ví đã bị lưu trữ.', 400);
    }

    // 1. Phân tích cấu trúc bảng CSV
    const { rows: grid, delimiter } = csvParser.parseCsvToGrid(file_content);
    if (grid.length < 2) {
        throw new AppError('File CSV phải chứa ít nhất 1 dòng tiêu đề và 1 dòng dữ liệu.', 400);
    }

    const headerRow = grid[0];
    const dataRows = grid.slice(1);

    if (dataRows.length > MAX_ROWS) {
        throw new AppError(`File CSV chứa ${dataRows.length} dòng dữ liệu, vượt quá giới hạn tối đa ${MAX_ROWS} dòng/lần nhập.`, 400);
    }

    // 2. Tính file_hash và kiểm tra xem file đã từng được nhập chưa
    const fileHash = computeFileHash(file_content);
    const previousBatch = await importRepository.findBatchByHash(fileHash);

    // 3. Xác định ánh xạ cột
    const detectedMapping = csvParser.detectColumnMapping(headerRow);
    const activeMapping = {
        dateCol: column_mapping?.dateCol !== undefined ? column_mapping.dateCol : detectedMapping.dateCol,
        amountCol: column_mapping?.amountCol !== undefined ? column_mapping.amountCol : detectedMapping.amountCol,
        inflowCol: column_mapping?.inflowCol !== undefined ? column_mapping.inflowCol : detectedMapping.inflowCol,
        outflowCol: column_mapping?.outflowCol !== undefined ? column_mapping.outflowCol : detectedMapping.outflowCol,
        noteCol: column_mapping?.noteCol !== undefined ? column_mapping.noteCol : detectedMapping.noteCol,
        categoryCol: column_mapping?.categoryCol !== undefined ? column_mapping.categoryCol : detectedMapping.categoryCol
    };

    // 4. Lấy danh mục để map nếu trong file có sẵn tên danh mục
    const categories = await categoryRepository.findAll();

    // 5. Chuẩn bị tập dữ liệu ứng viên để kiểm tra trùng lặp
    const parsedRows = [];
    let minDate = '9999-99-99';
    let maxDate = '0000-00-00';
    const candidateRowHashes = [];

    for (let i = 0; i < dataRows.length; i++) {
        const rowCells = dataRows[i];
        const rowNum = i + 2; // Số dòng trên file thực tế (header là dòng 1)

        const rawDate = activeMapping.dateCol !== null && rowCells[activeMapping.dateCol] ? rowCells[activeMapping.dateCol] : '';
        const rawNote = activeMapping.noteCol !== null && rowCells[activeMapping.noteCol] ? rowCells[activeMapping.noteCol] : '';
        const rawCategory = activeMapping.categoryCol !== null && rowCells[activeMapping.categoryCol] ? rowCells[activeMapping.categoryCol] : '';

        // Xử lý số tiền và chiều biến động
        let detectedAmount = null;
        let detectedType = 'expense';
        let amountError = null;

        // Ưu tiên 1: Cột Thu và Chi riêng biệt
        const hasSeparateCols = (activeMapping.inflowCol !== null || activeMapping.outflowCol !== null);
        if (hasSeparateCols) {
            const rawInflow = activeMapping.inflowCol !== null && rowCells[activeMapping.inflowCol] ? rowCells[activeMapping.inflowCol] : '';
            const rawOutflow = activeMapping.outflowCol !== null && rowCells[activeMapping.outflowCol] ? rowCells[activeMapping.outflowCol] : '';

            const parsedIn = csvParser.parseMoney(rawInflow);
            const parsedOut = csvParser.parseMoney(rawOutflow);

            if (parsedIn && parsedIn.amount > 0) {
                detectedAmount = parsedIn.amount;
                detectedType = 'income';
            } else if (parsedOut && parsedOut.amount > 0) {
                detectedAmount = parsedOut.amount;
                detectedType = 'expense';
            } else {
                amountError = 'Không tìm thấy số tiền thu/chi hợp lệ.';
            }
        } else if (activeMapping.amountCol !== null) {
            // Cột số tiền chung
            const rawAmount = rowCells[activeMapping.amountCol] || '';
            const parsedAmt = csvParser.parseMoney(rawAmount);
            if (parsedAmt && parsedAmt.amount > 0) {
                detectedAmount = parsedAmt.amount;
                detectedType = parsedAmt.type;
            } else {
                amountError = 'Số tiền không hợp lệ hoặc bằng 0.';
            }
        } else {
            amountError = 'Chưa cấu hình cột số tiền.';
        }

        const normalizedDate = csvParser.parseDate(rawDate);
        if (normalizedDate) {
            if (normalizedDate < minDate) minDate = normalizedDate;
            if (normalizedDate > maxDate) maxDate = normalizedDate;
        }

        const noteText = rawNote.trim() || `Sao kê dòng ${rowNum}`;

        const isRowValid = Boolean(normalizedDate && detectedAmount && !amountError);
        const rowHash = isRowValid
            ? computeRowHash(numAccountId, normalizedDate, detectedAmount, detectedType, noteText)
            : null;

        if (rowHash) {
            candidateRowHashes.push(rowHash);
        }

        parsedRows.push({
            row_index: i,
            row_num: rowNum,
            raw_date: rawDate,
            date: normalizedDate,
            amount: detectedAmount,
            type: detectedType,
            note: noteText,
            raw_category: rawCategory,
            category_id: null,
            category_name: null,
            matched_rule: null,
            row_hash: rowHash,
            status: isRowValid ? 'valid' : 'error',
            error_message: !normalizedDate ? 'Ngày không hợp lệ (hỗ trợ DD/MM/YYYY, YYYY-MM-DD)' : amountError,
            is_duplicate: false
        });
    }

    // 6. Kiểm tra trùng lặp với CSDL hiện tại (SPEC 4.5)
    const existingHashes = await importRepository.findExistingRowHashes(numAccountId, candidateRowHashes);
    let potentialDups = [];
    if (minDate <= maxDate) {
        potentialDups = await importRepository.findPotentialDuplicates(numAccountId, {
            startDate: minDate,
            endDate: maxDate
        });
    }

    // Đếm và phát hiện trùng lặp
    let validCount = 0;
    let duplicateCount = 0;
    let errorCount = 0;

    for (const row of parsedRows) {
        if (row.status === 'error') {
            errorCount++;
            continue;
        }

        // Kiểm tra xem row_hash có khớp giao dịch trước đó không
        let isDup = existingHashes.has(row.row_hash);

        // Hoặc kiểm tra xem có giao dịch cùng ngày, cùng số tiền và cùng loại trong ví không
        if (!isDup && potentialDups.length > 0) {
            const matchedTx = potentialDups.find((tx) => {
                const txDate = tx.transaction_date instanceof Date
                    ? tx.transaction_date.toISOString().slice(0, 10)
                    : String(tx.transaction_date).slice(0, 10);
                return (
                    txDate === row.date &&
                    Number(tx.amount) === Number(row.amount) &&
                    tx.type === row.type
                );
            });
            if (matchedTx) {
                isDup = true;
                row.duplicate_hint = `Nghi trùng với giao dịch #${matchedTx.id} (${row.date} - ${row.amount}₫)`;
            }
        }

        if (isDup) {
            row.status = 'duplicate';
            row.is_duplicate = true;
            duplicateCount++;
        } else {
            validCount++;
        }

        // 7. Tự động áp dụng Category Rules Engine (SPEC 4.4 & 4.5)
        const matchedRule = await ruleService.matchRule(row.note, row.type, numAccountId);
        if (matchedRule) {
            row.category_id = matchedRule.category_id;
            row.category_name = matchedRule.category_name;
            row.matched_rule = {
                id: matchedRule.id,
                keyword: matchedRule.keyword
            };
        } else if (row.raw_category) {
            // Thử khớp với danh mục sẵn có theo tên
            const foundCat = categories.find(c => 
                c.type === row.type && 
                c.name.toLowerCase() === row.raw_category.trim().toLowerCase()
            );
            if (foundCat) {
                row.category_id = foundCat.id;
                row.category_name = foundCat.name;
            }
        }

        // Nếu chưa có danh mục, tự động gán danh mục mặc định phù hợp với loại giao dịch
        if (!row.category_id) {
            const defaultCat = categories.find(c => c.type === row.type);
            if (defaultCat) {
                row.category_id = defaultCat.id;
                row.category_name = defaultCat.name;
                row.is_default_category = true;
            }
        }
    }

    return {
        file_name,
        file_hash: fileHash,
        account_id: numAccountId,
        account_name: account.name,
        total_rows: dataRows.length,
        valid_count: validCount,
        duplicate_count: duplicateCount,
        error_count: errorCount,
        is_file_duplicate: Boolean(previousBatch),
        previous_batch: previousBatch ? {
            id: previousBatch.id,
            imported_at: previousBatch.created_at,
            imported_rows: previousBatch.imported_rows
        } : null,
        detected_mapping: detectedMapping,
        active_mapping: activeMapping,
        headers: headerRow,
        rows: parsedRows
    };
};

/**
 * Xác nhận nhập các dòng giao dịch đã được chọn vào CSDL (ACID Transaction - SPEC 4.5)
 */
const confirmImport = async (payload = {}) => {
    const {
        file_name = 'statement.csv',
        file_hash,
        account_id,
        rows = []
    } = payload;

    if (!file_hash) {
        throw new AppError('Thiếu mã kiểm tra tính toàn vẹn (file_hash).', 400);
    }

    const numAccountId = Number(account_id);
    if (!Number.isSafeInteger(numAccountId) || numAccountId <= 0) {
        throw new AppError('Vui lòng chọn ví hợp lệ.', 400);
    }

    const account = await accountRepository.findById(numAccountId);
    if (!account || account.is_archived) {
        throw new AppError('Ví không tồn tại hoặc đã bị lưu trữ.', 400);
    }

    // Lọc ra các dòng người dùng chọn nhập (bỏ qua dòng lỗi hoặc dòng người dùng không tích)
    const selectedRows = rows.filter(r => r.selected === true && r.status !== 'error');
    if (selectedRows.length === 0) {
        throw new AppError('Không có dòng giao dịch nào được chọn để nhập.', 400);
    }

    const categories = await categoryRepository.findAll();
    const defaultExpenseCat = categories.find(c => c.type === 'expense');
    const defaultIncomeCat = categories.find(c => c.type === 'income');

    // Danh sách các dòng bị bỏ qua hoặc lỗi để lưu vào error_log
    const skippedRows = rows.filter(r => !r.selected || r.status === 'error');

    // Chạy trong MySQL Database Transaction (ACID)
    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();

        // 1. Tạo đợt nhập trong import_batches
        const [batchResult] = await connection.query(
            `INSERT INTO import_batches 
             (file_name, file_hash, account_id, total_rows, imported_rows, skipped_rows, status, error_log)
             VALUES (?, ?, ?, ?, ?, ?, 'completed', ?)`,
            [
                file_name,
                file_hash,
                numAccountId,
                rows.length,
                selectedRows.length,
                skippedRows.length,
                skippedRows.length > 0 ? JSON.stringify(skippedRows.map(r => ({
                    row_num: r.row_num,
                    date: r.date,
                    amount: r.amount,
                    note: r.note,
                    reason: r.error_message || (r.is_duplicate ? 'Bị bỏ qua do nghi trùng' : 'Người dùng bỏ chọn')
                }))) : null
            ]
        );
        const batchId = batchResult.insertId;

        // 2. Thêm từng giao dịch được chọn vào bảng transactions
        for (const row of selectedRows) {
            const amount = Number(row.amount);
            const dateStr = String(row.date).slice(0, 10);
            const txType = ['income', 'expense'].includes(row.type) ? row.type : 'expense';
            let categoryId = row.category_id ? Number(row.category_id) : null;
            if (!categoryId) {
                categoryId = txType === 'income' ? defaultIncomeCat?.id : defaultExpenseCat?.id;
            }
            const noteStr = typeof row.note === 'string' && row.note.trim() ? row.note.trim() : 'Sao kê ngân hàng';
            const rowHash = row.row_hash || computeRowHash(numAccountId, dateStr, amount, txType, noteStr);

            await connection.query(
                `INSERT INTO transactions 
                 (amount, type, account_id, transfer_account_id, category_id, import_batch_id, import_row_hash, transaction_date, note)
                 VALUES (?, ?, ?, NULL, ?, ?, ?, ?, ?)`,
                [amount, txType, numAccountId, categoryId, batchId, rowHash, dateStr, noteStr]
            );
        }

        await connection.commit();

        return {
            success: true,
            batch_id: batchId,
            imported_count: selectedRows.length,
            skipped_count: skippedRows.length,
            total_rows: rows.length,
            message: `Đã nhập thành công ${selectedRows.length} giao dịch vào ví "${account.name}".`
        };
    } catch (err) {
        await connection.rollback();
        throw err;
    } finally {
        connection.release();
    }
};

/**
 * Lấy lịch sử các đợt nhập sao kê
 */
const getBatches = async () => {
    return await importRepository.findAllBatches();
};

/**
 * Lấy chi tiết một đợt nhập theo ID
 */
const getBatchById = async (id) => {
    const numId = Number(id);
    if (!Number.isSafeInteger(numId) || numId <= 0) {
        throw new AppError('Mã đợt nhập không hợp lệ.', 400);
    }
    const batch = await importRepository.findBatchById(numId);
    if (!batch) {
        throw new AppError('Không tìm thấy đợt nhập sao kê.', 404);
    }
    return batch;
};

module.exports = {
    computeFileHash,
    computeRowHash,
    previewCsv,
    confirmImport,
    getBatches,
    getBatchById
};
