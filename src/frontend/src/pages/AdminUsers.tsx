import { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import { getErrorMessage } from '../utils/getErrorMessage';
import toast from 'react-hot-toast';
import { Plus, Edit2, Trash2, Shield, User as UserIcon, Building2, Search, Lock, Unlock, AlertTriangle } from 'lucide-react';

type Role = 'AUDIENCE' | 'ORGANIZER' | 'STAFF' | 'SUPER_ADMIN';

interface User {
  id: string;
  email: string;
  role: Role;
  status: 'ACTIVE' | 'LOCKED';
  created_at: string;
  organizer_id?: string;
  organizer?: { email: string };
  _count?: {
    tickets?: number;
    concerts?: number;
  };
}

interface Organizer {
  id: string;
  email: string;
}

export default function AdminUsers() {
  const { token, user: currentUser } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [organizers, setOrganizers] = useState<Organizer[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Trạng thái tab hiện tại
  const [activeTab, setActiveTab] = useState<'STAFF' | 'ORGANIZER' | 'AUDIENCE'>('STAFF');

  // Phân trang & Tìm kiếm
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  // Trạng thái Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    role: 'STAFF' as Role,
    organizer_id: ''
  });

  // Action Modal (Lock/Delete)
  const [actionUser, setActionUser] = useState<User | null>(null);
  const [actionType, setActionType] = useState<'SELECT' | 'CONFIRM_LOCK' | 'CONFIRM_UNLOCK' | 'CONFIRM_DELETE' | null>(null);

  const isSuperAdmin = currentUser?.role === 'SUPER_ADMIN';

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1); // Reset page on search
    }, 500);
    return () => clearTimeout(handler);
  }, [search]);

  useEffect(() => {
    fetchUsers();
    if (isSuperAdmin) {
      fetchOrganizers();
    }
  }, [token, isSuperAdmin, activeTab, page, debouncedSearch]);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const res = await axios.get(`${import.meta.env.VITE_API_URL || 'http://localhost:3001/api'}/users`, {
        params: {
          filterRole: activeTab,
          page,
          limit: 20,
          search: debouncedSearch
        },
        headers: { Authorization: `Bearer ${token}` }
      });
      setUsers(res.data.data);
      setTotalPages(res.data.totalPages);
    } catch (error) {
      toast.error(getErrorMessage(error, 'Lỗi khi tải danh sách người dùng'));
    } finally {
      setLoading(false);
    }
  };

  const fetchOrganizers = async () => {
    try {
      const res = await axios.get(`${import.meta.env.VITE_API_URL || 'http://localhost:3001/api'}/users/organizers`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setOrganizers(res.data);
    } catch (error) {
      console.error('Failed to fetch organizers', error);
    }
  };

  const executeDelete = async (id: string) => {
    try {
      await axios.delete(`${import.meta.env.VITE_API_URL || 'http://localhost:3001/api'}/users/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Xóa tài khoản thành công!');
      fetchUsers();
    } catch (error) {
      toast.error(getErrorMessage(error, 'Không thể xóa tài khoản này (Có thể do đã có dữ liệu liên quan)'));
    } finally {
      setActionUser(null);
      setActionType(null);
    }
  };

  const executeToggleStatus = async (id: string, currentStatus: string) => {
    try {
      const newStatus = currentStatus === 'ACTIVE' ? 'LOCKED' : 'ACTIVE';
      await axios.put(`${import.meta.env.VITE_API_URL || 'http://localhost:3001/api'}/users/${id}/status`, { status: newStatus }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success(newStatus === 'LOCKED' ? 'Đã khóa tài khoản!' : 'Đã mở khóa tài khoản!');
      fetchUsers();
    } catch (error) {
      toast.error(getErrorMessage(error, 'Lỗi cập nhật trạng thái'));
    } finally {
      setActionUser(null);
      setActionType(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingUser) {
        // Cập nhật
        await axios.put(`${import.meta.env.VITE_API_URL || 'http://localhost:3001/api'}/users/${editingUser.id}`, formData, {
          headers: { Authorization: `Bearer ${token}` }
        });
        toast.success('Cập nhật tài khoản thành công!');
      } else {
        // Tạo mới
        await axios.post(`${import.meta.env.VITE_API_URL || 'http://localhost:3001/api'}/users`, formData, {
          headers: { Authorization: `Bearer ${token}` }
        });
        toast.success('Tạo tài khoản mới thành công!');
      }
      setIsModalOpen(false);
      fetchUsers();
    } catch (error) {
      toast.error(getErrorMessage(error, 'Lỗi lưu dữ liệu tài khoản'));
    }
  };

  const openCreateModal = () => {
    setEditingUser(null);
    setFormData({
      email: '',
      password: '',
      role: activeTab,
      organizer_id: ''
    });
    setIsModalOpen(true);
  };

  const openEditModal = (user: User) => {
    setEditingUser(user);
    setFormData({
      email: user.email,
      password: '', // Không tải mật khẩu cũ
      role: user.role,
      organizer_id: user.organizer_id || ''
    });
    setIsModalOpen(true);
  };

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Quản lý Tài Khoản</h1>
          <p className="text-slate-400">Phân quyền và quản lý nhân sự trên hệ thống</p>
        </div>
        <button
          onClick={openCreateModal}
          className="bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2 rounded-xl font-medium transition-all flex items-center gap-2"
        >
          <Plus className="w-5 h-5" />
          Tạo tài khoản mới
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-slate-700 mb-6">
        <button
          onClick={() => { setActiveTab('STAFF'); setPage(1); setSearch(''); }}
          className={`px-6 py-3 font-medium transition-all border-b-2 flex items-center gap-2 ${activeTab === 'STAFF' ? 'border-emerald-500 text-emerald-400' : 'border-transparent text-slate-400 hover:text-white'}`}
        >
          <Shield className="w-4 h-4" /> Nhân viên Soát vé
        </button>
        
        {isSuperAdmin && (
          <>
            <button
              onClick={() => { setActiveTab('ORGANIZER'); setPage(1); setSearch(''); }}
              className={`px-6 py-3 font-medium transition-all border-b-2 flex items-center gap-2 ${activeTab === 'ORGANIZER' ? 'border-emerald-500 text-emerald-400' : 'border-transparent text-slate-400 hover:text-white'}`}
            >
              <Building2 className="w-4 h-4" /> Ban Tổ Chức
            </button>
            <button
              onClick={() => { setActiveTab('AUDIENCE'); setPage(1); setSearch(''); }}
              className={`px-6 py-3 font-medium transition-all border-b-2 flex items-center gap-2 ${activeTab === 'AUDIENCE' ? 'border-emerald-500 text-emerald-400' : 'border-transparent text-slate-400 hover:text-white'}`}
            >
              <UserIcon className="w-4 h-4" /> Khán giả
            </button>
          </>
        )}
      </div>

      <div className="mb-6 relative">
        <input 
          type="text" 
          placeholder="Tìm kiếm theo email..." 
          className="w-full bg-slate-800 border border-slate-700 text-white px-12 py-3 rounded-xl focus:border-emerald-500 outline-none"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <Search className="w-5 h-5 text-slate-400 absolute left-4 top-3.5" />
      </div>

      {/* Data Table */}
      <div className="bg-slate-800 rounded-2xl overflow-hidden border border-slate-700 mb-6">
        <table className="w-full text-left">
          <thead className="bg-slate-900/50">
            <tr>
              <th className="p-4 text-slate-300 font-medium">Email</th>
              <th className="p-4 text-slate-300 font-medium">Vai trò</th>
              {activeTab === 'STAFF' && <th className="p-4 text-slate-300 font-medium">Thuộc về (Organizer)</th>}
              {activeTab === 'AUDIENCE' && <th className="p-4 text-slate-300 font-medium text-center">Số vé đã mua</th>}
              {activeTab === 'ORGANIZER' && <th className="p-4 text-slate-300 font-medium text-center">Số sự kiện</th>}
              <th className="p-4 text-slate-300 font-medium">Trạng thái</th>
              <th className="p-4 text-slate-300 font-medium">Ngày tạo</th>
              <th className="p-4 text-slate-300 font-medium text-right">Thao tác</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-700">
            {loading ? (
               <tr>
                <td colSpan={8} className="p-8 text-center text-slate-400">Đang tải dữ liệu...</td>
               </tr>
            ) : users.length === 0 ? (
              <tr>
                <td colSpan={8} className="p-8 text-center text-slate-500">
                  Không tìm thấy tài khoản nào trong nhóm này.
                </td>
              </tr>
            ) : (
              users.map((u) => (
                <tr key={u.id} className={`hover:bg-slate-700/30 transition-colors ${u.status === 'LOCKED' ? 'opacity-75' : ''}`}>
                  <td className="p-4 text-white font-medium">{u.email}</td>
                  <td className="p-4">
                    <span className={`px-2 py-1 text-xs font-bold rounded-lg ${
                      u.role === 'STAFF' ? 'bg-blue-500/20 text-blue-400' : 
                      u.role === 'ORGANIZER' ? 'bg-amber-500/20 text-amber-400' : 
                      'bg-slate-500/20 text-slate-400'
                    }`}>
                      {u.role}
                    </span>
                  </td>
                  {activeTab === 'STAFF' && (
                    <td className="p-4 text-slate-400 text-sm">
                      {u.organizer?.email || 'N/A'}
                    </td>
                  )}
                  {activeTab === 'AUDIENCE' && (
                    <td className="p-4 text-slate-300 font-bold text-center">
                      {u._count?.tickets || 0}
                    </td>
                  )}
                  {activeTab === 'ORGANIZER' && (
                    <td className="p-4 text-slate-300 font-bold text-center">
                      {u._count?.concerts || 0}
                    </td>
                  )}
                  <td className="p-4">
                     {u.status === 'ACTIVE' ? (
                       <span className="px-2 py-1 text-xs font-bold bg-emerald-500/20 text-emerald-400 rounded-lg">Hoạt động</span>
                     ) : (
                       <span className="px-2 py-1 text-xs font-bold bg-rose-500/20 text-rose-400 rounded-lg flex items-center gap-1 w-max">
                         <Lock className="w-3 h-3" /> Đã khóa
                       </span>
                     )}
                  </td>
                  <td className="p-4 text-slate-400 text-sm">
                    {new Date(u.created_at).toLocaleDateString()}
                  </td>
                  <td className="p-4 text-right flex justify-end gap-2">
                    <button onClick={() => openEditModal(u)} className="p-2 text-slate-400 hover:text-emerald-400 transition-colors">
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button 
                      onClick={() => { setActionUser(u); setActionType('SELECT'); }} 
                      className="p-2 text-slate-400 hover:text-rose-400 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {!loading && totalPages > 1 && (
        <div className="flex justify-between items-center bg-slate-800 p-4 rounded-xl border border-slate-700">
          <p className="text-sm text-slate-400">Trang {page} / {totalPages}</p>
          <div className="flex gap-2">
            <button 
              disabled={page === 1}
              onClick={() => setPage(p => Math.max(1, p - 1))}
              className="px-4 py-2 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 disabled:hover:bg-slate-700 rounded-lg text-sm font-medium transition-colors"
            >
              Trước
            </button>
            <button 
              disabled={page === totalPages}
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              className="px-4 py-2 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 disabled:hover:bg-slate-700 rounded-lg text-sm font-medium transition-colors"
            >
              Sau
            </button>
          </div>
        </div>
      )}

      {/* Action Modal (Double Confirmation) */}
      {actionUser && actionType && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
          <div className="bg-slate-800 rounded-3xl p-8 w-full max-w-md border border-slate-700 shadow-2xl">
            {actionType === 'SELECT' && (
              <>
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-3 bg-amber-500/20 rounded-xl">
                    <AlertTriangle className="w-6 h-6 text-amber-500" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-white">Xử lý Tài khoản</h2>
                    <p className="text-slate-400 text-sm">Chọn hành động cho {actionUser.email}</p>
                  </div>
                </div>
                
                <div className="space-y-3">
                  <button 
                    onClick={() => setActionType(actionUser.status === 'ACTIVE' ? 'CONFIRM_LOCK' : 'CONFIRM_UNLOCK')}
                    className="w-full flex items-center gap-3 p-4 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 transition-colors text-left"
                  >
                    {actionUser.status === 'ACTIVE' ? (
                      <>
                        <Lock className="w-5 h-5 text-amber-500" />
                        <div>
                          <p className="font-bold text-amber-500">Khóa tài khoản</p>
                          <p className="text-xs text-amber-500/70">Tài khoản này sẽ không thể đăng nhập nữa.</p>
                        </div>
                      </>
                    ) : (
                      <>
                        <Unlock className="w-5 h-5 text-emerald-500" />
                        <div>
                          <p className="font-bold text-emerald-500">Mở khóa tài khoản</p>
                          <p className="text-xs text-emerald-500/70">Cho phép tài khoản đăng nhập trở lại.</p>
                        </div>
                      </>
                    )}
                  </button>
                  <button 
                    onClick={() => setActionType('CONFIRM_DELETE')}
                    className="w-full flex items-center gap-3 p-4 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 transition-colors text-left"
                  >
                    <Trash2 className="w-5 h-5 text-rose-500" />
                    <div>
                      <p className="font-bold text-rose-500">Xóa vĩnh viễn</p>
                      <p className="text-xs text-rose-500/70">Xóa dữ liệu vĩnh viễn (Chỉ xóa được nếu chưa có giao dịch).</p>
                    </div>
                  </button>
                </div>
                <button 
                  onClick={() => { setActionUser(null); setActionType(null); }}
                  className="w-full mt-6 py-3 font-bold text-slate-400 hover:text-white transition-colors"
                >
                  Hủy bỏ
                </button>
              </>
            )}

            {actionType === 'CONFIRM_LOCK' && (
              <>
                <h2 className="text-xl font-bold text-amber-500 mb-2">Xác nhận Khóa tài khoản</h2>
                <p className="text-slate-300 mb-6">Bạn có chắc chắn muốn khóa tài khoản <span className="font-bold text-white">{actionUser.email}</span> không? Người dùng này sẽ lập tức bị chặn đăng nhập.</p>
                <div className="flex gap-3">
                  <button onClick={() => setActionType('SELECT')} className="flex-1 py-3 bg-slate-700 hover:bg-slate-600 rounded-xl font-bold transition-colors">Quay lại</button>
                  <button onClick={() => executeToggleStatus(actionUser.id, 'ACTIVE')} className="flex-1 py-3 bg-amber-500 hover:bg-amber-600 text-amber-950 rounded-xl font-bold transition-colors">Vâng, Khóa ngay</button>
                </div>
              </>
            )}

            {actionType === 'CONFIRM_UNLOCK' && (
              <>
                <h2 className="text-xl font-bold text-emerald-500 mb-2">Xác nhận Mở khóa</h2>
                <p className="text-slate-300 mb-6">Bạn có chắc chắn muốn mở khóa cho tài khoản <span className="font-bold text-white">{actionUser.email}</span>?</p>
                <div className="flex gap-3">
                  <button onClick={() => setActionType('SELECT')} className="flex-1 py-3 bg-slate-700 hover:bg-slate-600 rounded-xl font-bold transition-colors">Quay lại</button>
                  <button onClick={() => executeToggleStatus(actionUser.id, 'LOCKED')} className="flex-1 py-3 bg-emerald-500 hover:bg-emerald-600 text-emerald-950 rounded-xl font-bold transition-colors">Mở khóa</button>
                </div>
              </>
            )}

            {actionType === 'CONFIRM_DELETE' && (
              <>
                <h2 className="text-xl font-bold text-rose-500 mb-2">CẢNH BÁO XÓA DỮ LIỆU</h2>
                <p className="text-slate-300 mb-6">Bạn đang yêu cầu xóa vĩnh viễn tài khoản <span className="font-bold text-white">{actionUser.email}</span>. Hành động này không thể hoàn tác.</p>
                <div className="flex gap-3">
                  <button onClick={() => setActionType('SELECT')} className="flex-1 py-3 bg-slate-700 hover:bg-slate-600 rounded-xl font-bold transition-colors">Quay lại</button>
                  <button onClick={() => executeDelete(actionUser.id)} className="flex-1 py-3 bg-rose-500 hover:bg-rose-600 text-white rounded-xl font-bold transition-colors">Đồng ý Xóa</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Modal CRUD */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-800 rounded-3xl p-6 w-full max-w-md border border-slate-700">
            <h2 className="text-xl font-bold text-white mb-6">
              {editingUser ? 'Chỉnh sửa tài khoản' : 'Tạo tài khoản mới'}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              
              <div>
                <label className="block text-sm text-slate-400 mb-1">Email</label>
                <input
                  type="email"
                  required
                  disabled={!!editingUser}
                  className="w-full bg-slate-900 border border-slate-700 text-white rounded-xl p-3 focus:border-emerald-500 outline-none disabled:opacity-50"
                  value={formData.email}
                  onChange={(e) => setFormData({...formData, email: e.target.value})}
                />
              </div>

              <div>
                <label className="block text-sm text-slate-400 mb-1">Mật khẩu {editingUser && '(Bỏ trống nếu không đổi)'}</label>
                <input
                  type="password"
                  required={!editingUser}
                  className="w-full bg-slate-900 border border-slate-700 text-white rounded-xl p-3 focus:border-emerald-500 outline-none"
                  value={formData.password}
                  onChange={(e) => setFormData({...formData, password: e.target.value})}
                />
              </div>

              {isSuperAdmin && (
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Vai trò {editingUser && '(Không thể thay đổi)'}</label>
                  <select
                    disabled={!!editingUser}
                    className="w-full bg-slate-900 border border-slate-700 text-white rounded-xl p-3 focus:border-emerald-500 outline-none disabled:opacity-50 cursor-not-allowed"
                    value={formData.role}
                    onChange={(e) => setFormData({...formData, role: e.target.value as Role})}
                  >
                    <option value="STAFF">Soát vé (Staff)</option>
                    <option value="ORGANIZER">Ban Tổ Chức (Organizer)</option>
                    <option value="AUDIENCE">Khán giả (Audience)</option>
                  </select>
                </div>
              )}

              {/* Chỉ hiển thị Dropdown gán Organizer nếu tạo/sửa STAFF và người dùng là SUPER_ADMIN */}
              {isSuperAdmin && formData.role === 'STAFF' && (
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Thuộc về Ban Tổ Chức (Organizer)</label>
                  <select
                    required
                    className="w-full bg-slate-900 border border-slate-700 text-white rounded-xl p-3 focus:border-emerald-500 outline-none"
                    value={formData.organizer_id}
                    onChange={(e) => setFormData({...formData, organizer_id: e.target.value})}
                  >
                    <option value="">-- Chọn Ban Tổ Chức --</option>
                    {organizers.map(org => (
                      <option key={org.id} value={org.id}>{org.email}</option>
                    ))}
                  </select>
                </div>
              )}

              <div className="pt-4 flex gap-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 bg-slate-700 hover:bg-slate-600 text-white py-3 rounded-xl font-medium transition-colors"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white py-3 rounded-xl font-medium transition-colors"
                >
                  Lưu
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
