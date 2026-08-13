// frontend/src/pages/RolesManagement.jsx
import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import {
  Plus, Edit, Trash2, Save, X,
  Shield, Lock, Users, Package,
  ShoppingCart, FileText, Calendar,
  BarChart, Settings, Check, AlertCircle,
  Search, Filter, ChevronDown, ChevronUp
} from 'lucide-react';

const moduleIcons = {
  clientes: Users,
  servicios: Settings,
  inventario: Package,
  alquileres: Calendar,
  facturas: FileText,
  usuarios: Users,
  reportes: BarChart,
  tecnicos: Users,
  agenda: Calendar,
  roles: Shield,
};

const moduleColors = {
  clientes: 'bg-blue-100 text-blue-700',
  servicios: 'bg-purple-100 text-purple-700',
  inventario: 'bg-green-100 text-green-700',
  alquileres: 'bg-yellow-100 text-yellow-700',
  facturas: 'bg-red-100 text-red-700',
  usuarios: 'bg-indigo-100 text-indigo-700',
  reportes: 'bg-orange-100 text-orange-700',
  tecnicos: 'bg-cyan-100 text-cyan-700',
  agenda: 'bg-pink-100 text-pink-700',
  roles: 'bg-gray-100 text-gray-700',
};

const RolesManagement = () => {
  const { user } = useAuth();
  const [roles, setRoles] = useState([]);
  const [permissions, setPermissions] = useState({});
  const [loading, setLoading] = useState(true);
  const [editingRole, setEditingRole] = useState(null);
  const [isCreating, setIsCreating] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedModules, setExpandedModules] = useState({});
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    is_default: false,
    permissions: [],
  });
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [rolesRes, permissionsRes] = await Promise.all([
        api.get('/api/roles'),
        api.get('/api/roles/permissions/all'),
      ]);

      setRoles(rolesRes.data.data || []);
      setPermissions(permissionsRes.data.data || {});

      const expanded = {};
      Object.keys(permissionsRes.data.data || {}).forEach(module => {
        expanded[module] = true;
      });
      setExpandedModules(expanded);
    } catch (error) {
      console.error('Error fetching data:', error);
      setError('Error al cargar los datos. Por favor, intenta nuevamente.');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = () => {
    setIsCreating(true);
    setEditingRole(null);
    setFormData({
      name: '',
      description: '',
      is_default: false,
      permissions: [],
    });
    setError(null);
    setSuccess(null);
  };

  const handleEdit = (role) => {
    setIsCreating(false);
    setEditingRole(role.id);
    setFormData({
      name: role.name,
      description: role.description || '',
      is_default: role.is_default || false,
      permissions: role.permissions ? role.permissions.map(p => p.id) : [],
    });
    setError(null);
    setSuccess(null);
  };

  const handleCancel = () => {
    setIsCreating(false);
    setEditingRole(null);
    setFormData({
      name: '',
      description: '',
      is_default: false,
      permissions: [],
    });
    setError(null);
    setSuccess(null);
  };

  const handleSave = async () => {
    try {
      setLoading(true);
      setError(null);

      if (!formData.name.trim()) {
        setError('El nombre del rol es requerido');
        setLoading(false);
        return;
      }

      if (isCreating) {
        await api.post('/api/roles', formData);
        setSuccess('Rol creado exitosamente');
      } else {
        await api.put(`/api/roles/${editingRole}`, formData);
        setSuccess('Rol actualizado exitosamente');
      }

      await fetchData();
      handleCancel();

      setTimeout(() => setSuccess(null), 3000);
    } catch (error) {
      console.error('Error saving role:', error);
      setError(error.response?.data?.message || 'Error al guardar el rol');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('¿Estás seguro de eliminar este rol? Esta acción no se puede deshacer.')) return;

    try {
      setLoading(true);
      setError(null);
      await api.delete(`/api/roles/${id}`);
      setSuccess('Rol eliminado exitosamente');
      await fetchData();
      setTimeout(() => setSuccess(null), 3000);
    } catch (error) {
      console.error('Error deleting role:', error);
      setError(error.response?.data?.message || 'Error al eliminar el rol');
    } finally {
      setLoading(false);
    }
  };

  const togglePermission = (permissionId) => {
    setFormData(prev => ({
      ...prev,
      permissions: prev.permissions.includes(permissionId)
        ? prev.permissions.filter(id => id !== permissionId)
        : [...prev.permissions, permissionId],
    }));
  };

  const toggleModule = (module) => {
    setExpandedModules(prev => ({
      ...prev,
      [module]: !prev[module],
    }));
  };

  const toggleAllPermissions = (modulePermissions, checked) => {
    const permissionIds = modulePermissions.map(p => p.id);
    setFormData(prev => {
      const newPermissions = checked
        ? [...new Set([...prev.permissions, ...permissionIds])]
        : prev.permissions.filter(id => !permissionIds.includes(id));
      return { ...prev, permissions: newPermissions };
    });
  };

  const toggleAllGlobalPermissions = () => {
    const allPermissionIds = Object.values(permissions).flat().map(p => p.id);
    const allSelected = allPermissionIds.every(id => formData.permissions.includes(id));
    setFormData(prev => ({
      ...prev,
      permissions: allSelected ? [] : allPermissionIds
    }));
  };

  const getModulePermissions = (module) => {
    return permissions[module] || [];
  };

  const isModuleFullyChecked = (module) => {
    const modulePerms = getModulePermissions(module);
    if (modulePerms.length === 0) return false;
    return modulePerms.every(p => formData.permissions.includes(p.id));
  };

  const isModulePartiallyChecked = (module) => {
    const modulePerms = getModulePermissions(module);
    if (modulePerms.length === 0) return false;
    const checkedCount = modulePerms.filter(p => formData.permissions.includes(p.id)).length;
    return checkedCount > 0 && checkedCount < modulePerms.length;
  };

  const filteredRoles = roles.filter(role =>
    role.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (role.description && role.description.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const allPermissionIds = Object.values(permissions).flat().map(p => p.id);
  const areAllPermissionsSelected = allPermissionIds.length > 0 && 
    allPermissionIds.every(id => formData.permissions.includes(id));

  if (loading && !roles.length) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="page-content">
      {/* Header con estilos consistentes */}
      <div className="page-header">
        <div>
          <h1 className="page-title flex items-center gap-2">
            <Shield className="w-7 h-7 text-blue-600" />
            Administración de Roles
          </h1>
          <p className="page-description">Gestiona los roles y permisos del sistema</p>
        </div>
        <button
          onClick={handleCreate}
          className="btn-primary"
          disabled={loading}
        >
          <Plus className="w-5 h-5" />
          Nuevo Rol
        </button>
      </div>

      {/* Notificaciones */}
      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-center gap-2">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span>{error}</span>
          <button onClick={() => setError(null)} className="ml-auto text-red-700 hover:text-red-900">
            <X className="w-5 h-5" />
          </button>
        </div>
      )}

      {success && (
        <div className="mb-4 bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg flex items-center gap-2">
          <Check className="w-5 h-5 flex-shrink-0" />
          <span>{success}</span>
          <button onClick={() => setSuccess(null)} className="ml-auto text-green-700 hover:text-green-900">
            <X className="w-5 h-5" />
          </button>
        </div>
      )}

      {/* Formulario de creación/edición - Estilos consistentes */}
      {(isCreating || editingRole) && (
        <div className="surface p-6 mb-6 border-2 border-blue-200">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold flex items-center gap-2 text-system-primary">
              {isCreating ? (
                <>
                  <Plus className="w-6 h-6 text-blue-600" />
                  Crear Nuevo Rol
                </>
              ) : (
                <>
                  <Edit className="w-6 h-6 text-blue-600" />
                  Editar Rol
                </>
              )}
            </h2>
            <button
              onClick={handleCancel}
              className="icon-button"
              disabled={loading}
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          <div className="form-grid mb-4">
            <div>
              <label className="form-label">
                Nombre del Rol <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Ej: Super Admin"
                disabled={loading}
              />
            </div>
            <div>
              <label className="form-label">
                Descripción
              </label>
              <input
                type="text"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Breve descripción del rol"
                disabled={loading}
              />
            </div>
          </div>

          <div className="mb-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.is_default}
                onChange={(e) => setFormData({ ...formData, is_default: e.target.checked })}
                disabled={loading}
              />
              <span className="text-sm font-medium text-system-secondary">
                Rol por defecto para nuevos usuarios
              </span>
            </label>
          </div>

          {/* Permisos con Toolbar integrado */}
          <div className="mt-6">
            <div className="permissions-toolbar">
              <div className="permissions-toolbar-info">
                <h3 className="text-lg font-semibold flex items-center gap-2 text-system-primary">
                  <Lock className="w-5 h-5 text-system-muted" />
                  Permisos del Rol
                </h3>
                <p className="text-system-muted text-sm mt-0.5">
                  {formData.permissions.length} de {allPermissionIds.length} permisos seleccionados
                </p>
              </div>

              <div className="permissions-toolbar-actions">
                <button
                  type="button"
                  onClick={toggleAllGlobalPermissions}
                  className={`btn-permissions-all ${
                    areAllPermissionsSelected ? 'is-active' : ''
                  }`}
                  disabled={loading || allPermissionIds.length === 0}
                >
                  {areAllPermissionsSelected ? (
                    <>
                      <X className="w-4 h-4" />
                      Deseleccionar todos
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      Seleccionar todos
                    </>
                  )}
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 max-h-96 overflow-y-auto p-1">
              {Object.keys(permissions).map((module) => {
                const modulePerms = getModulePermissions(module);
                const Icon = moduleIcons[module] || Lock;
                const isFullyChecked = isModuleFullyChecked(module);
                const isPartiallyChecked = isModulePartiallyChecked(module);
                const isExpanded = expandedModules[module];

                return (
                  <div key={module} className="permission-module">
                    <div
                      className={`permission-module-header ${isExpanded ? 'is-open' : ''} ${moduleColors[module] || 'bg-gray-100'}`}
                      onClick={() => toggleModule(module)}
                    >
                      <div className="flex items-center gap-2">
                        <Icon className="w-5 h-5" />
                        <h4 className="font-medium capitalize text-system-primary">{module}</h4>
                        <span className="permission-count">
                          {modulePerms.length}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={isFullyChecked}
                          ref={(el) => {
                            if (el) el.indeterminate = isPartiallyChecked;
                          }}
                          onChange={(e) => {
                            e.stopPropagation();
                            toggleAllPermissions(modulePerms, e.target.checked);
                          }}
                          className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                          onClick={(e) => e.stopPropagation()}
                        />
                        {isExpanded ? (
                          <ChevronUp className="w-4 h-4 text-system-muted" />
                        ) : (
                          <ChevronDown className="w-4 h-4 text-system-muted" />
                        )}
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="permission-module-body">
                        {modulePerms.map(permission => (
                          <label key={permission.id} className="permission-item">
                            <input
                              type="checkbox"
                              checked={formData.permissions.includes(permission.id)}
                              onChange={() => togglePermission(permission.id)}
                              disabled={loading}
                            />
                            <span className="text-sm text-system-secondary">
                              {permission.description || permission.name}
                            </span>
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Botones de acción */}
          <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-system">
            <button
              onClick={handleCancel}
              className="btn-secondary"
              disabled={loading}
            >
              Cancelar
            </button>
            <button
              onClick={handleSave}
              className="btn-primary"
              disabled={loading}
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  Guardando...
                </>
              ) : (
                <>
                  <Save className="w-5 h-5" />
                  Guardar
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Barra de búsqueda - Estilo consistente */}
      {roles.length > 0 && (
        <div className="mb-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-system-muted" />
            <input
              type="text"
              placeholder="Buscar roles..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-4 py-2"
            />
          </div>
        </div>
      )}

      {/* Lista de roles - Grid consistente */}
      {filteredRoles.length === 0 && !loading ? (
        <div className="empty-state">
          <Shield className="w-16 h-16 text-system-muted mx-auto mb-4 opacity-40" />
          <h3 className="text-lg font-medium text-system-primary">No hay roles</h3>
          <p className="text-system-muted mt-1">
            {searchTerm ? 'No se encontraron roles con esa búsqueda' : 'Crea tu primer rol haciendo clic en "Nuevo Rol"'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredRoles.map(role => {
            const rolePermissions = role.permissions || [];
            const groupedPermissions = rolePermissions.reduce((acc, p) => {
              if (!acc[p.module]) acc[p.module] = [];
              acc[p.module].push(p);
              return acc;
            }, {});

            return (
              <div key={role.id} className="surface p-5 hover:shadow-md transition-shadow">
                <div className="flex justify-between items-start mb-3">
                  <div className="flex-1 min-w-0">
                    <h3 className="text-lg font-bold text-system-primary truncate">{role.name}</h3>
                    {role.description && (
                      <p className="text-sm text-system-muted truncate">{role.description}</p>
                    )}
                  </div>
                  {role.is_default && (
                    <span className="badge badge-success flex-shrink-0 ml-2">
                      Por Defecto
                    </span>
                  )}
                </div>

                <div className="flex flex-wrap gap-1 mt-3">
                  {Object.keys(groupedPermissions).slice(0, 4).map(module => (
                    <span key={module} className={`permission-chip ${moduleColors[module] || 'bg-gray-100 text-gray-700'}`}>
                      {module}: {groupedPermissions[module].length}
                    </span>
                  ))}
                  {Object.keys(groupedPermissions).length > 4 && (
                    <span className="permission-chip">
                      +{Object.keys(groupedPermissions).length - 4} más
                    </span>
                  )}
                </div>

                <div className="flex justify-end gap-1 mt-4 pt-4 border-t border-system">
                  <button
                    onClick={() => handleEdit(role)}
                    className="icon-button icon-button-primary"
                    title="Editar rol"
                  >
                    <Edit className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => handleDelete(role.id)}
                    className="icon-button icon-button-danger"
                    title="Eliminar rol"
                    disabled={role.is_default || loading}
                  >
                    <Trash2 className={`w-5 h-5 ${role.is_default ? 'opacity-50' : ''}`} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default RolesManagement;