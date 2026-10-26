import { useState, useEffect, useMemo, useCallback } from "react";
import { ruleApi, getApiErrorMessage } from "../../services/api";
import { useCategories } from "../../contexts/CategoryContext";
import { useAccounts } from "../../contexts/AccountContext";

export default function RuleManager() {
  const { categories } = useCategories();
  const { activeAccounts } = useAccounts();

  const [rules, setRules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  // Bộ lọc
  const [typeFilter, setTypeFilter] = useState("all"); // "all" | "expense" | "income"

  // Form state
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [keyword, setKeyword] = useState("");
  const [matchType, setMatchType] = useState("contains");
  const [transactionType, setTransactionType] = useState("expense");
  const [categoryId, setCategoryId] = useState("");
  const [accountId, setAccountId] = useState("");
  const [priority, setPriority] = useState(0);

  const refreshRules = useCallback(async () => {
    try {
      setLoading(true);
      setErrorMessage("");
      const res = await ruleApi.list();
      setRules(res.data?.data || []);
    } catch (err) {
      setErrorMessage(getApiErrorMessage(err, "Không thể tải danh sách quy tắc."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let ignore = false;
    ruleApi
      .list()
      .then((res) => {
        if (!ignore) {
          setRules(res.data?.data || []);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!ignore) {
          setErrorMessage(getApiErrorMessage(err, "Không thể tải danh sách quy tắc."));
          setLoading(false);
        }
      });
    return () => {
      ignore = true;
    };
  }, []);

  // Cập nhật categoryId mặc định khi transactionType thay đổi
  const availableCategories = useMemo(() => {
    return categories.filter((c) => c.type === transactionType);
  }, [categories, transactionType]);

  const handleTypeChange = (newType) => {
    setTransactionType(newType);
    const matched = categories.filter((c) => c.type === newType);
    setCategoryId(matched[0] ? String(matched[0].id) : "");
  };

  const handleOpenCreate = () => {
    setEditingId(null);
    setKeyword("");
    setMatchType("contains");
    setTransactionType("expense");
    const expenseCats = categories.filter((c) => c.type === "expense");
    setCategoryId(expenseCats[0] ? String(expenseCats[0].id) : "");
    setAccountId("");
    setPriority(0);
    setShowForm(true);
    setErrorMessage("");
    setSuccessMessage("");
  };

  const handleStartEdit = (rule) => {
    setEditingId(rule.id);
    setKeyword(rule.keyword);
    setMatchType(rule.match_type || "contains");
    setTransactionType(rule.transaction_type);
    setCategoryId(String(rule.category_id));
    setAccountId(rule.account_id ? String(rule.account_id) : "");
    setPriority(rule.priority || 0);
    setShowForm(true);
    setErrorMessage("");
    setSuccessMessage("");
  };

  const handleCancelForm = () => {
    setShowForm(false);
    setEditingId(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage("");
    setSuccessMessage("");

    if (!keyword.trim()) {
      setErrorMessage("Vui lòng nhập từ khóa.");
      return;
    }
    if (!categoryId) {
      setErrorMessage("Vui lòng chọn danh mục.");
      return;
    }

    const payload = {
      keyword: keyword.trim(),
      match_type: matchType,
      transaction_type: transactionType,
      category_id: Number(categoryId),
      account_id: accountId ? Number(accountId) : null,
      priority: Number(priority) || 0,
    };

    try {
      setSaving(true);
      if (editingId) {
        await ruleApi.update(editingId, payload);
        setSuccessMessage("Đã cập nhật quy tắc thành công.");
      } else {
        await ruleApi.create(payload);
        setSuccessMessage("Đã tạo mới quy tắc thành công.");
      }
      setShowForm(false);
      setEditingId(null);
      await refreshRules();
    } catch (err) {
      setErrorMessage(getApiErrorMessage(err, "Không thể lưu quy tắc."));
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (rule) => {
    try {
      await ruleApi.toggle(rule.id);
      setRules((prev) =>
        prev.map((r) => (r.id === rule.id ? { ...r, is_active: r.is_active ? 0 : 1 } : r))
      );
    } catch (err) {
      setErrorMessage(getApiErrorMessage(err, "Không thể bật/tắt quy tắc."));
    }
  };

  const handleDelete = async (rule) => {
    if (!window.confirm(`Bạn có chắc chắn muốn xóa quy tắc cho từ khóa "${rule.keyword}"?`)) {
      return;
    }
    try {
      await ruleApi.remove(rule.id);
      setRules((prev) => prev.filter((r) => r.id !== rule.id));
      setSuccessMessage(`Đã xóa quy tắc "${rule.keyword}".`);
    } catch (err) {
      setErrorMessage(getApiErrorMessage(err, "Không thể xóa quy tắc."));
    }
  };

  // Điều chỉnh nhanh độ ưu tiên (tăng/giảm 1)
  const handlePriorityChange = async (rule, delta) => {
    const newPriority = Math.max(0, (rule.priority || 0) + delta);
    if (newPriority === rule.priority) return;

    try {
      await ruleApi.update(rule.id, {
        keyword: rule.keyword,
        match_type: rule.match_type,
        transaction_type: rule.transaction_type,
        category_id: rule.category_id,
        account_id: rule.account_id,
        priority: newPriority,
        is_active: rule.is_active,
      });
      await refreshRules();
    } catch (err) {
      setErrorMessage(getApiErrorMessage(err, "Không thể cập nhật độ ưu tiên."));
    }
  };

  const filteredRules = useMemo(() => {
    if (typeFilter === "all") return rules;
    return rules.filter((r) => r.transaction_type === typeFilter);
  }, [rules, typeFilter]);

  return (
    <section className="panel" aria-labelledby="rule-title">
      <div className="section-heading">
        <div>
          <h2 id="rule-title">Quy tắc tự gán danh mục</h2>
          <span>Tự động nhận diện danh mục cho thông báo Inbox theo từ khóa và độ ưu tiên</span>
        </div>
        {!showForm && (
          <button type="button" className="button-primary" onClick={handleOpenCreate}>
            + Thêm quy tắc
          </button>
        )}
      </div>

      {errorMessage && <div className="message error">{errorMessage}</div>}
      {successMessage && <div className="message success">{successMessage}</div>}

      {/* Form tạo / sửa quy tắc */}
      {showForm && (
        <form onSubmit={handleSubmit} className="rule-form-box">
          <div className="rule-form-header">
            <h3>{editingId ? "Chỉnh sửa quy tắc" : "Tạo quy tắc mới"}</h3>
            <button type="button" className="sheet-close-btn" onClick={handleCancelForm}>
              ✕
            </button>
          </div>

          <div className="form-row-2col">
            <div className="form-group">
              <label htmlFor="rule-keyword" className="form-label">
                Từ khóa nhận diện *
              </label>
              <input
                id="rule-keyword"
                type="text"
                required
                maxLength="100"
                placeholder="VD: GRAB, SHOPEE, PHUC LONG, TIEN DIEN"
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
              />
              <span className="form-help-amount">
                Không phân biệt chữ hoa/thường hay có dấu tiếng Việt.
              </span>
            </div>

            <div className="form-group">
              <label htmlFor="rule-match-type" className="form-label">
                Kiểu khớp từ khóa
              </label>
              <select
                id="rule-match-type"
                value={matchType}
                onChange={(e) => setMatchType(e.target.value)}
              >
                <option value="contains">Chứa từ khóa (Contains - Khuyên dùng)</option>
                <option value="exact">Khớp nguyên từ chính xác (Exact Word)</option>
              </select>
            </div>
          </div>

          <div className="form-row-3col">
            <div className="form-group">
              <span className="form-label">Loại giao dịch</span>
              <div className="sheet-type-pills">
                <button
                  type="button"
                  className={`pill-btn ${transactionType === "expense" ? "active expense" : ""}`}
                  onClick={() => handleTypeChange("expense")}
                >
                  Chi tiêu
                </button>
                <button
                  type="button"
                  className={`pill-btn ${transactionType === "income" ? "active income" : ""}`}
                  onClick={() => handleTypeChange("income")}
                >
                  Thu nhập
                </button>
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="rule-category" className="form-label">
                Gán danh mục đích *
              </label>
              <select
                id="rule-category"
                value={categoryId}
                required
                onChange={(e) => setCategoryId(e.target.value)}
              >
                <option value="">-- Chọn danh mục --</option>
                {availableCategories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="rule-account" className="form-label">
                Áp dụng cho ví
              </label>
              <select
                id="rule-account"
                value={accountId}
                onChange={(e) => setAccountId(e.target.value)}
              >
                <option value="">-- Mọi ví (Mặc định) --</option>
                {activeAccounts.map((acc) => (
                  <option key={acc.id} value={acc.id}>
                    {acc.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="form-row-2col">
            <div className="form-group">
              <label htmlFor="rule-priority" className="form-label">
                Độ ưu tiên (Priority)
              </label>
              <input
                id="rule-priority"
                type="number"
                min="0"
                max="999999"
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
              />
              <span className="form-help-amount">
                Số càng lớn độ ưu tiên càng cao khi nhiều quy tắc cùng khớp.
              </span>
            </div>
          </div>

          <div className="rule-form-actions">
            <button
              type="button"
              className="button-secondary"
              onClick={handleCancelForm}
              disabled={saving}
            >
              Hủy
            </button>
            <button type="submit" className="button-primary" disabled={saving}>
              {saving ? "Đang lưu..." : editingId ? "Cập nhật quy tắc" : "Tạo quy tắc"}
            </button>
          </div>
        </form>
      )}

      {/* Bộ lọc loại giao dịch */}
      <div className="rule-filter-bar">
        <div className="rule-filter-pills">
          <button
            type="button"
            className={`rule-pill-btn ${typeFilter === "all" ? "active" : ""}`}
            onClick={() => setTypeFilter("all")}
          >
            Tất cả ({rules.length})
          </button>
          <button
            type="button"
            className={`rule-pill-btn ${typeFilter === "expense" ? "active expense" : ""}`}
            onClick={() => setTypeFilter("expense")}
          >
            Chi tiêu ({rules.filter((r) => r.transaction_type === "expense").length})
          </button>
          <button
            type="button"
            className={`rule-pill-btn ${typeFilter === "income" ? "active income" : ""}`}
            onClick={() => setTypeFilter("income")}
          >
            Thu nhập ({rules.filter((r) => r.transaction_type === "income").length})
          </button>
        </div>
      </div>

      {/* Danh sách quy tắc */}
      {loading ? (
        <div className="table-empty">Đang tải danh sách quy tắc...</div>
      ) : filteredRules.length === 0 ? (
        <div className="table-empty">
          <p>Chưa có quy tắc tự gán nào.</p>
          <span>
            Bấm <strong>"+ Thêm quy tắc"</strong> ở trên để tạo từ khóa nhận diện danh mục tự động.
          </span>
        </div>
      ) : (
        <div className="rule-list">
          {filteredRules.map((rule) => {
            return (
              <div
                key={rule.id}
                className={`rule-card ${!rule.is_active ? "inactive" : ""}`}
              >
                <div className="rule-card-left">
                  <div className="rule-keyword-row">
                    <span className="rule-keyword-badge">"{rule.keyword}"</span>
                    <span className={`rule-type-badge ${rule.transaction_type}`}>
                      {rule.transaction_type === "income" ? "Thu nhập" : "Chi tiêu"}
                    </span>
                    <span className="rule-match-pill">
                      {rule.match_type === "exact" ? "Nguyên từ" : "Chứa từ"}
                    </span>
                    {!rule.is_active && (
                      <span className="rule-inactive-badge">Đã tắt</span>
                    )}
                  </div>

                  <div className="rule-target-row">
                    <span className="rule-arrow">➔ Danh mục:</span>
                    <strong className="rule-cat-name">{rule.category_name}</strong>
                    {rule.account_name && (
                      <span className="rule-acc-pill">Ví: {rule.account_name}</span>
                    )}
                  </div>
                </div>

                <div className="rule-card-right">
                  <div className="rule-priority-control" title="Độ ưu tiên (số lớn xét trước)">
                    <span className="priority-label">Ưu tiên:</span>
                    <button
                      type="button"
                      className="priority-btn"
                      onClick={() => handlePriorityChange(rule, -1)}
                      disabled={rule.priority <= 0}
                      title="Giảm ưu tiên"
                    >
                      -
                    </button>
                    <span className="priority-value">{rule.priority || 0}</span>
                    <button
                      type="button"
                      className="priority-btn"
                      onClick={() => handlePriorityChange(rule, 1)}
                      title="Tăng ưu tiên"
                    >
                      +
                    </button>
                  </div>

                  <button
                    type="button"
                    className={`rule-toggle-btn ${rule.is_active ? "active" : ""}`}
                    onClick={() => handleToggle(rule)}
                    title={rule.is_active ? "Bấm để tắt quy tắc" : "Bấm để bật quy tắc"}
                  >
                    {rule.is_active ? "Đang bật" : "Đã tắt"}
                  </button>

                  <button
                    type="button"
                    className="button-secondary button-small"
                    onClick={() => handleStartEdit(rule)}
                  >
                    Sửa
                  </button>

                  <button
                    type="button"
                    className="button-secondary button-small button-danger"
                    onClick={() => handleDelete(rule)}
                  >
                    Xóa
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

