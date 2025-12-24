'use client';

import React, { useState } from 'react';
import { Plus, X, BarChart3, Settings, FileText, Users, LayoutDashboard, LogOut, Edit2, Check, GraduationCap } from 'lucide-react';

interface CustomColumn {
  id: string;
  label: string;
  type: 'text' | 'number' | 'select';
  options?: string[];
}

interface Student {
  id: number;
  rollNo: string;
  name: string;
  attendance: Record<string, 'P' | 'A' | 'L' | undefined>;
  [key: string]: any;
}

interface Class {
  id: number;
  name: string;
  students?: Student[];  // ✅ optional
  customColumns: CustomColumn[];
}

interface SidebarProps {
  collapsed: boolean;
  classes: Class[];
  activeClassId: number | null;
  onClassSelect: (id: number) => void;
  onAddClass: () => void;
  onDeleteClass: (id: number, e: React.MouseEvent) => void;
  onViewAllClasses: () => void;
  onViewSnapshot: () => void;
  onOpenSettings: () => void;
  onLogout: () => void;
  onUpdateClassName: (id: number, newName: string) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  collapsed,
  classes,
  activeClassId,
  onClassSelect,
  onAddClass,
  onDeleteClass,
  onViewAllClasses,
  onViewSnapshot,
  onOpenSettings,
  onLogout,
  onUpdateClassName,
}) => {
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [editingClassId, setEditingClassId] = useState<number | null>(null);
  const [editedClassName, setEditedClassName] = useState('');

  const displayedClasses = classes.slice(0, 3);

  const handleLogoutClick = () => {
    setShowLogoutConfirm(true);
  };

  const confirmLogout = () => {
    setIsLoggingOut(true);
    setTimeout(() => {
      onLogout();
    }, 1200);
  };

  const handleStartEdit = (classId: number, currentName: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingClassId(classId);
    setEditedClassName(currentName);
  };

  const handleSaveEdit = (classId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (editedClassName.trim() && editedClassName !== classes.find(c => c.id === classId)?.name) {
      onUpdateClassName(classId, editedClassName.trim());
    }
    setEditingClassId(null);
    setEditedClassName('');
  };

  const handleCancelEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingClassId(null);
    setEditedClassName('');
  };

  return (
    <>
      <aside
        className={`${
          collapsed ? 'w-0' : 'w-72'
        } bg-white border-r border-emerald-100 flex-shrink-0 transition-all duration-300 overflow-hidden flex flex-col`}
      >
        <div className="flex-1 overflow-y-auto p-4">
          <div className="mb-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-slate-600 uppercase tracking-wider flex items-center gap-2">
                <GraduationCap className="w-4 h-4" />
                My Classes
              </h2>
            </div>

            {displayedClasses.map(cls => {
              const isActive = activeClassId === cls.id;
              const isEditing = editingClassId === cls.id;
              
              return (
                <div
                  key={cls.id}
                  onClick={() => !isEditing && onClassSelect(cls.id)}
                  className={`group relative px-4 py-3 rounded-xl cursor-pointer transition-all ${
                    isActive
                      ? 'bg-gradient-to-r from-emerald-50 to-teal-50 shadow-sm border border-emerald-100'
                      : 'hover:bg-emerald-50/50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    {isEditing ? (
                      <div className="flex items-center gap-2 flex-1" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="text"
                          value={editedClassName}
                          onChange={(e) => setEditedClassName(e.target.value)}
                          className="text-sm font-medium bg-white border border-emerald-500 rounded px-2 py-0.5 focus:outline-none focus:ring-1 focus:ring-emerald-500 flex-1 min-w-0"
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleSaveEdit(cls.id, e as any);
                            if (e.key === 'Escape') handleCancelEdit(e as any);
                          }}
                        />
                        <button
                          onClick={(e) => handleSaveEdit(cls.id, e)}
                          className="p-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded transition-colors flex-shrink-0"
                          title="Save"
                        >
                          <Check className="w-4 h-4" />
                        </button>
                        <button
                          onClick={handleCancelEdit}
                          className="p-1 bg-gray-400 hover:bg-gray-500 text-white rounded transition-colors flex-shrink-0"
                          title="Cancel"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <>
                        <div className="flex-1 min-w-0">
                          <h3 className="text-sm font-medium text-slate-900 mb-0.5 truncate">
                            {cls.name}
                          </h3>
                          <p className="text-xs text-slate-500">
                            {(cls.students || []).length} students  {/* ✅ guarded */}
                          </p>
                        </div>
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={(e) => handleStartEdit(cls.id, cls.name, e)}
                            className="p-1.5 hover:bg-emerald-50 rounded-lg transition-all cursor-pointer"
                            title="Edit class name"
                          >
                            <Edit2 className="w-3.5 h-3.5 text-emerald-600" />
                          </button>
                          <button
                            onClick={(e) => onDeleteClass(cls.id, e)}
                            className="p-1.5 hover:bg-rose-50 rounded-lg transition-all cursor-pointer"
                            title="Delete class"
                          >
                            <X className="w-3.5 h-3.5 text-rose-600" />
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              );
            })}

            {/* Dashboard Snapshot Button */}
            {classes.length > 0 && (
              <button
                onClick={onViewSnapshot}
                className="w-full mt-3 px-4 py-3 rounded-xl bg-gradient-to-r from-blue-50 to-indigo-50 hover:from-blue-100 hover:to-indigo-100 border border-blue-200 transition-all text-left group"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-500 text-white rounded-lg group-hover:scale-110 transition-transform">
                    <BarChart3 className="w-4 h-4" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-sm font-semibold text-blue-900">Dashboard</h3>
                    <p className="text-xs text-blue-600">Overview</p>
                  </div>
                </div>
              </button>
            )}

            {/* View All Classes Button */}
            {classes.length > 0 && (
              <button
                onClick={onViewAllClasses}
                className="w-full mt-3 px-4 py-3 rounded-xl bg-gradient-to-r from-purple-50 to-pink-50 hover:from-purple-100 hover:to-pink-100 border border-purple-200 transition-all text-left group"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-purple-500 text-white rounded-lg group-hover:scale-110 transition-transform">
                    <Users className="w-4 h-4" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-sm font-semibold text-purple-900">All Classes ({classes.length})</h3>
                    <p className="text-xs text-purple-600">View all</p>
                  </div>
                </div>
              </button>
            )}

            {/* Empty State */}
            {classes.length === 0 && (
              <div className="mt-4 p-6 bg-gradient-to-br from-emerald-50 to-teal-50 rounded-xl border border-emerald-200 text-center">
                <GraduationCap className="w-12 h-12 mx-auto text-emerald-400 mb-3" />
                <p className="text-sm text-slate-600 mb-4">No classes yet</p>
                <button
                  onClick={onAddClass}
                  className="w-full px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  Create First Class
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Fixed Quick Access Section at Bottom */}
        <div className="border-t border-emerald-100 p-4 bg-gradient-to-br from-slate-50 to-emerald-50">
          <div className="space-y-2">
            <button
              onClick={onOpenSettings}
              className="w-full px-4 py-2.5 bg-white hover:bg-emerald-50 text-slate-700 rounded-lg font-medium transition-all flex items-center gap-2 shadow-sm hover:shadow border border-slate-200 hover:border-emerald-200 cursor-pointer"
            >
              <Settings className="w-4 h-4" />
              Settings
            </button>

            <button
              onClick={handleLogoutClick}
              className="w-full px-4 py-2.5 bg-white hover:bg-rose-50 text-slate-700 rounded-lg font-medium transition-all flex items-center gap-2 shadow-sm hover:shadow border border-slate-200 hover:border-rose-200 cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
              Logout
            </button>
          </div>
        </div>
      </aside>

      {/* Logout Confirmation Modal */}
      {showLogoutConfirm && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-4">
            <h3 className="text-xl font-bold text-slate-900">Confirm Logout</h3>
            <p className="text-slate-600">
              Are you sure you want to logout?
            </p>
            <p className="text-sm text-slate-500">
              You will be redirected to the login page and will need to sign in again to access your classes.
            </p>
            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setShowLogoutConfirm(false)}
                disabled={isLoggingOut}
                className="flex-1 px-4 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-xl transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
              <button
                onClick={confirmLogout}
                disabled={isLoggingOut}
                className="flex-1 px-4 py-3 bg-rose-600 hover:bg-rose-700 text-white font-medium rounded-xl transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isLoggingOut ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Logging out...
                  </>
                ) : (
                  'Logout'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* LOGOUT TRANSITION OVERLAY - THIS MUST BE AFTER THE MODAL */}
      {isLoggingOut && (
        <div className="fixed inset-0 bg-gradient-to-br from-emerald-600 to-teal-600 z-[60] flex items-center justify-center">
          <div className="text-center">
            <div className="w-20 h-20 border-4 border-white border-t-transparent rounded-full animate-spin mx-auto mb-6"></div>
            <h2 className="text-2xl font-bold text-white mb-2">Logging Out...</h2>
            <p className="text-emerald-100">See you next time!</p>
          </div>
        </div>
      )}
    </>
  );
};
