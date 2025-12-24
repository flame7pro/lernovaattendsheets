'use client';

import React, { useState } from 'react';
import {
  Plus,
  X,
  BarChart3,
  Settings,
  FileText,
  Users,
  LayoutDashboard,
  LogOut,
  Edit2,
  Check,
  GraduationCap,
} from 'lucide-react';

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
  students?: Student[];              // ✅ optional now
  customColumns: CustomColumn[];
}

interface SidebarProps {
  collapsed: boolean;
  classes?: Class[];                 // ✅ optional
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
  classes = [],                         // ✅ default array
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

  const handleStartEdit = (
    classId: number,
    currentName: string,
    e: React.MouseEvent
  ) => {
    e.stopPropagation();
    setEditingClassId(classId);
    setEditedClassName(currentName);
  };

  const handleSaveEdit = (classId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    const trimmed = editedClassName.trim();
    if (
      trimmed &&
      trimmed !== classes.find((c) => c.id === classId)?.name
    ) {
      onUpdateClassName(classId, trimmed);
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
        className={`h-full border-r bg-white/80 backdrop-blur-xl shadow-sm flex flex-col transition-all duration-300 ${
          collapsed ? 'w-20' : 'w-80'
        }`}
      >
        {/* Top brand + add class */}
        <div className="px-4 py-4 flex items-center justify-between border-b border-emerald-100">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-sm">
              <GraduationCap className="w-5 h-5 text-white" />
            </div>
            {!collapsed && (
              <div className="flex flex-col">
                <span className="text-sm font-semibold text-slate-900">
                  Lernova Sheets
                </span>
                <span className="text-[11px] text-emerald-600 font-medium">
                  Teacher Dashboard
                </span>
              </div>
            )}
          </div>

          <button
            onClick={onAddClass}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-emerald-500 to-teal-500 text-white text-xs font-semibold shadow-sm hover:shadow-md transition-all"
          >
            <Plus className="w-4 h-4" />
            {!collapsed && <span>New class</span>}
          </button>
        </div>

        {/* Main nav */}
        <nav className="flex-1 overflow-y-auto">
          {/* Primary actions */}
          <div className="px-3 pt-3 space-y-1">
            <button
              onClick={() => onViewSnapshot()}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                activeClassId === null
                  ? 'bg-gradient-to-r from-emerald-50 to-teal-50 text-emerald-700 shadow-sm border border-emerald-100'
                  : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              <LayoutDashboard className="w-4 h-4" />
              {!collapsed && <span>Dashboard snapshot</span>}
            </button>

            <button
              onClick={onViewSnapshot}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors"
            >
              <BarChart3 className="w-4 h-4" />
              {!collapsed && <span>Analytics</span>}
            </button>

            <button
              onClick={onViewAllClasses}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors"
            >
              <Users className="w-4 h-4" />
              {!collapsed && (
                <span>
                  All classes{' '}
                  {classes.length > 0 && `(${classes.length})`}
                </span>
              )}
            </button>
          </div>

          {/* Classes list */}
          <div className="mt-4 px-3">
            {!collapsed && (
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">
                  My classes
                </span>
                {classes.length > 3 && (
                  <button
                    onClick={onViewAllClasses}
                    className="text-[11px] font-medium text-emerald-600 hover:text-emerald-700"
                  >
                    View all
                  </button>
                )}
              </div>
            )}

            <div className="space-y-2">
              {displayedClasses.map((cls) => {
                const isActive = activeClassId === cls.id;
                const isEditing = editingClassId === cls.id;
                const students = cls.students ?? []; // ✅ guard

                return (
                  <div
                    key={cls.id}
                    onClick={!isEditing ? () => onClassSelect(cls.id) : undefined}
                    className={`group relative px-4 py-3 rounded-xl cursor-pointer transition-all ${
                      isActive
                        ? 'bg-gradient-to-r from-emerald-50 to-teal-50 shadow-sm border border-emerald-100'
                        : 'hover:bg-emerald-50/50'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white text-sm font-semibold shadow-sm">
                        {cls.name.charAt(0).toUpperCase()}
                      </div>

                      <div className="flex-1 min-w-0">
                        {isEditing ? (
                          <div className="flex items-center gap-2">
                            <input
                              value={editedClassName}
                              onChange={(e) =>
                                setEditedClassName(e.target.value)
                              }
                              onClick={(e) => e.stopPropagation()}
                              className="text-sm font-medium bg-white border border-emerald-500 rounded px-2 py-0.5 focus:outline-none focus:ring-1 focus:ring-emerald-500 flex-1 min-w-0"
                              autoFocus
                              onKeyDown={(e) => {
                                if (e.key === 'Enter')
                                  handleSaveEdit(cls.id, e as any);
                                if (e.key === 'Escape')
                                  handleCancelEdit(e as any);
                              }}
                            />
                            <button
                              onClick={(e) => handleSaveEdit(cls.id, e)}
                              className="p-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded transition-colors flex-shrink-0"
                              title="Save"
                            >
                              <Check className="w-3 h-3" />
                            </button>
                            <button
                              onClick={handleCancelEdit}
                              className="p-1 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded transition-colors flex-shrink-0"
                              title="Cancel"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        ) : (
                          <>
                            <p className="text-sm font-semibold text-slate-900 truncate">
                              {cls.name}
                            </p>
                            <p className="text-xs text-emerald-600">
                              {students.length} students
                            </p>
                          </>
                        )}
                      </div>

                      {!isEditing && (
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={(e) =>
                              handleStartEdit(cls.id, cls.name, e)
                            }
                            className="p-1.5 hover:bg-emerald-50 rounded-lg transition-all cursor-pointer"
                            title="Edit class name"
                          >
                            <Edit2 className="w-3.5 h-3.5 text-emerald-700" />
                          </button>
                          <button
                            onClick={(e) => onDeleteClass(cls.id, e)}
                            className="p-1.5 hover:bg-rose-50 rounded-lg transition-all cursor-pointer"
                            title="Delete class"
                          >
                            <X className="w-3.5 h-3.5 text-rose-500" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}

              {classes.length === 0 && (
                <div className="mt-2 rounded-xl border border-dashed border-slate-200 bg-slate-50/70 px-4 py-4 text-center">
                  <p className="text-xs font-medium text-slate-600 mb-1">
                    No classes yet
                  </p>
                  <p className="text-[11px] text-slate-500 mb-3">
                    Create your first class to start taking attendance.
                  </p>
                  <button
                    onClick={onAddClass}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Create first class
                  </button>
                </div>
              )}
            </div>
          </div>
        </nav>

        {/* Bottom actions */}
        <div className="border-t border-slate-100 px-3 py-3 space-y-1">
          <button
            onClick={onOpenSettings}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors"
          >
            <Settings className="w-4 h-4" />
            {!collapsed && <span>Settings</span>}
          </button>
          <button
            onClick={handleLogoutClick}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-rose-600 hover:bg-rose-50 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            {!collapsed && <span>Logout</span>}
          </button>
        </div>
      </aside>

      {/* Logout confirmation modal */}
      {showLogoutConfirm && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full mx-4 p-6 space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-full bg-rose-50 flex items-center justify-center">
                <LogOut className="w-4 h-4 text-rose-500" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-slate-900">
                  Confirm logout
                </h2>
                <p className="text-xs text-slate-600 mt-1">
                  Are you sure you want to logout? You will be redirected to
                  the login page and will need to sign in again to access your
                  classes.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setShowLogoutConfirm(false)}
                disabled={isLoggingOut}
                className="px-4 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={confirmLogout}
                disabled={isLoggingOut}
                className="px-4 py-2 text-xs font-semibold text-white bg-rose-500 hover:bg-rose-600 rounded-xl transition-colors disabled:opacity-50"
              >
                {isLoggingOut ? 'Logging out...' : 'Logout'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Logout overlay */}
      {isLoggingOut && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-white/70 backdrop-blur-sm pointer-events-none">
          <div className="text-center space-y-2">
            <p className="text-sm font-semibold text-slate-800">
              Logging out...
            </p>
            <p className="text-xs text-slate-500">See you next time!</p>
          </div>
        </div>
      )}
    </>
  );
};
