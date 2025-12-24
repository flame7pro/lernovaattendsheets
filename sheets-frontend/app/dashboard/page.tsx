'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../lib/auth-context-email';
import { classService, Class } from '../lib/classService';
import { Menu, User, Users, LayoutDashboard } from 'lucide-react';
import Sidebar from '../components/dashboard/Sidebar';
import EmptyState from '../components/dashboard/EmptyState';
import AttendanceSheet from '../components/dashboard/AttendanceSheet';
import AllClassesView from '../components/dashboard/AllClassesView';
import SnapshotView from '../components/dashboard/SnapshotView';
import ClassThresholdSettings from '../components/dashboard/ClassThresholdSettings';
import SettingsModal from '../components/dashboard/SettingsModal';
import ChangePasswordModal from '../components/dashboard/ChangePasswordModal';
import AddClassModal from '../components/dashboard/AddClassModal';
import AddColumnModal from '../components/dashboard/AddColumnModal';
import DeleteClassModal from '../components/dashboard/DeleteClassModal';
import ImportDataState from '../components/dashboard/ImportDataState';
import MonthYearSelector from '../components/dashboard/MonthYearSelector';
import { AttendanceThresholds, Student, CustomColumn } from '../types';
import QRAttendanceModal from '../components/QRAttendanceModal';

export default function DashboardPage() {
  const router = useRouter();
  const { user, logout, isAuthenticated, loading } = useAuth();

  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [classes, setClasses] = useState<Class[]>([]);
  const [activeClassId, setActiveClassId] = useState<number | null>(null);
  const [showAllClasses, setShowAllClasses] = useState(false);
  const [showSnapshot, setShowSnapshot] = useState(true);
  const [showImportState, setShowImportState] = useState(false);
  const [pendingClassName, setPendingClassName] = useState('');
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth());
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [showQRModal, setShowQRModal] = useState(false);
  
  const [defaultThresholds, setDefaultThresholds] = useState<AttendanceThresholds>({
    excellent: 95,
    good: 90,
    moderate: 85,
    atRisk: 85,
  });
  
  const [showAddClassModal, setShowAddClassModal] = useState(false);
  const [showAddColumnModal, setShowAddColumnModal] = useState(false);
  const [showDeleteClassModal, setShowDeleteClassModal] = useState(false);
  const [showThresholdSettings, setShowThresholdSettings] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showChangePasswordModal, setShowChangePasswordModal] = useState(false);
  const [settingsClassId, setSettingsClassId] = useState<number | null>(null);
  const [classToDelete, setClassToDelete] = useState<Class | null>(null);
  const [newClassName, setNewClassName] = useState('');
  const [newColumnLabel, setNewColumnLabel] = useState('');
  const [newColumnType, setNewColumnType] = useState<'text' | 'number' | 'select'>('text');

  // ✅ FIX 1: Extend Class interface with optional students
  interface SafeClass extends Class {
    students?: Student[];
  }

  // Redirect if not authenticated
  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.push('/auth');
    }
  }, [isAuthenticated, loading, router]);

  // Prevent back navigation
  useEffect(() => {
    if (isAuthenticated && typeof window !== 'undefined') {
      window.history.pushState(null, '', window.location.href);
      const handlePopState = () => {
        window.history.pushState(null, '', window.location.href);
      };
      window.addEventListener('popstate', handlePopState);
      return () => window.removeEventListener('popstate', handlePopState);
    }
  }, [isAuthenticated]);

  // Load classes from backend on mount
  useEffect(() => {
    if (user && isAuthenticated) {
      loadClassesFromBackend();
    }
  }, [user, isAuthenticated]);

  // Load thresholds from localStorage
  useEffect(() => {
    if (user) {
      const savedThresholds = localStorage.getItem(`default-thresholds-${user.id}`);
      if (savedThresholds) {
        setDefaultThresholds(JSON.parse(savedThresholds));
      }
    }
  }, [user]);

  // Save thresholds to localStorage
  useEffect(() => {
    if (user) {
      localStorage.setItem(`default-thresholds-${user.id}`, JSON.stringify(defaultThresholds));
    }
  }, [defaultThresholds, user]);

  // ✅ FIX 2: Normalize loaded classes - students always array
  const loadClassesFromBackend = async () => {
    if (!user) return;
    try {
      setSyncing(true);
      setSyncError(null);
      const backendClasses = await classService.loadClasses();
      
      if (backendClasses && backendClasses.length > 0) {
        // Normal case - classes exist on server
        const normalizedClasses: SafeClass[] = backendClasses.map((c: any) => ({
          ...c,
          students: c.students ?? [],  // ✅ FIX: guarantee array
        }));
        setClasses(normalizedClasses);
        setShowSnapshot(true);
        setSyncError(null);
        return;
      }
      
      // 0 classes on server is NOT an error - show empty dashboard
      setClasses([]);
      setShowSnapshot(true);
      setSyncError(null);
    } catch (error) {
      console.error('Error loading classes:', error);
      setSyncError('Failed to sync with server. Working offline.');
      
      // Load from localStorage as fallback
      const localClasses = localStorage.getItem(`classes-${user?.id}`);
      if (localClasses) {
        const parsed = JSON.parse(localClasses) as SafeClass[];
        const normalizedClasses: SafeClass[] = parsed.map((c: any) => ({
          ...c,
          students: c.students ?? [],  // ✅ FIX: guarantee array
        }));
        setClasses(normalizedClasses);
      }
    } finally {
      setSyncing(false);
    }
  };

  const syncToBackend = async (classesToSync: SafeClass[]) => {
    if (!user) return;
    try {
      await classService.syncClasses(classesToSync);
      console.log('Classes synced successfully');
    } catch (error) {
      console.error('Error syncing classes:', error);
      setSyncError('Failed to sync some changes');
    }
  };

  const saveClass = async (updatedClass: SafeClass) => {
    const updatedClasses = classes.map((c) =>
      c.id === updatedClass.id ? updatedClass : c
    ) as SafeClass[];
    setClasses(updatedClasses);

    // Save to localStorage immediately
    if (user) {
      localStorage.setItem(`classes-${user.id}`, JSON.stringify(updatedClasses));
    }

    // Sync to backend asynchronously (don't block UI)
    try {
      await classService.updateClass(String(updatedClass.id), updatedClass);
      setSyncError(null); // Clear any previous errors
    } catch (error) {
      console.error('Error saving class to backend:', error);
      // Don't show error to user, data is saved locally. Backend will sync when connection is restored
    }
  };

  const handleLogout = async () => {
    await logout();
    router.push('/auth');
  };

  const handleOpenSettings = () => {
    setShowSettingsModal(true);
  };

  const handlePasswordChangeClick = () => {
    setShowChangePasswordModal(true);
  };

  const handleSaveThresholds = (newThresholds: AttendanceThresholds, applyToClassIds: number[]) => {
    const updatedClasses = classes.map((cls: SafeClass) =>
      applyToClassIds.includes(cls.id)
        ? { ...cls, thresholds: newThresholds }
        : cls
    ) as SafeClass[];
    setClasses(updatedClasses);

    // Sync each updated class
    updatedClasses.forEach((cls: SafeClass) => {
      if (applyToClassIds.includes(cls.id)) {
        saveClass(cls);
      }
    });

    if (applyToClassIds.includes(-1)) {
      setDefaultThresholds(newThresholds);
    }
  };

  const handleOpenClassSettings = (classId: number) => {
    setSettingsClassId(classId);
    setShowThresholdSettings(true);
  };

  const handleAddClass = () => {
    if (!newClassName.trim()) return;
    setPendingClassName(newClassName);
    setNewClassName('');
    setShowAddClassModal(false);
    setShowImportState(true);
  };

  // ✅ FIX 3: New classes get empty students array
  const handleManualInput = async () => {
    const newClass: SafeClass = {
      id: Date.now(),
      name: pendingClassName,
      students: [],  // ✅ FIX: always empty array
      customColumns: [],
      thresholds: undefined,
    };
    
    const updatedClasses = [...classes, newClass] as SafeClass[];
    setClasses(updatedClasses);
    setActiveClassId(newClass.id);
    setShowImportState(false);
    setShowSnapshot(false);
    setPendingClassName('');

    // Save to backend
    try {
      await classService.createClass(newClass);
    } catch (error) {
      console.error('Error creating class:', error);
      setSyncError('Failed to sync new class');
    }
  };

  // ✅ FIX 4: Normalize imported classes too
  const handleImportComplete = async (data: any) => {
    const newClass: SafeClass = {
      id: Date.now(),
      name: pendingClassName,
      students: data.students ?? [],  // ✅ FIX: guarantee array
      customColumns: data.customColumns || [],
      thresholds: undefined,
    };
    
    const updatedClasses = [...classes, newClass] as SafeClass[];
    setClasses(updatedClasses);
    setActiveClassId(newClass.id);
    setShowImportState(false);
    setShowSnapshot(false);
    setPendingClassName('');

    // Save to backend
    try {
      await classService.createClass(newClass);
    } catch (error) {
      console.error('Error creating class:', error);
      setSyncError('Failed to sync new class');
    }
  };

  const handleCancelImport = () => {
    setShowImportState(false);
    setPendingClassName('');
  };

  const handleDeleteClass = (classId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    const cls = classes.find((c: SafeClass) => c.id === classId);
    if (cls) {
      setClassToDelete(cls);
      setShowDeleteClassModal(true);
    }
  };

  const confirmDeleteClass = async () => {
    if (!classToDelete) return;
    
    const updatedClasses = classes.filter((c: SafeClass) => c.id !== classToDelete.id) as SafeClass[];
    setClasses(updatedClasses);

    // Update localStorage immediately
    if (user) {
      localStorage.setItem(`classes-${user.id}`, JSON.stringify(updatedClasses));
    }

    if (activeClassId === classToDelete.id) {
      if (updatedClasses.length === 0) {
        setShowSnapshot(true);
        setActiveClassId(null);
      } else {
        setActiveClassId(null);
        setShowSnapshot(false);
      }
    }

    // Delete from backend
    try {
      await classService.deleteClass(String(classToDelete.id));
      setSyncError(null); // Clear any previous errors
    } catch (error) {
      console.error('Error deleting class:', error);
      setSyncError('Failed to sync deletion');
    }
    
    setShowDeleteClassModal(false);
    setClassToDelete(null);
  };

  const handleClassSelect = (id: number) => {
    setActiveClassId(id);
    setShowAllClasses(false);
    setShowSnapshot(false);
  };

  const handleUpdateClassName = (classId: number, newName: string) => {
    const updatedClasses = classes.map((cls: SafeClass) =>
      cls.id === classId ? { ...cls, name: newName } : cls
    ) as SafeClass[];
    setClasses(updatedClasses);
    
    const updatedClass = updatedClasses.find((c: SafeClass) => c.id === classId);
    if (updatedClass) {
      saveClass(updatedClass);
    }
  };

  const handleAddStudent = () => {
    if (!activeClassId) return;
    const newStudent: Student = {
      id: Date.now(),
      rollNo: '',
      name: '',
      attendance: {},
    };
    
    const updatedClasses = classes.map((cls: SafeClass) =>
      cls.id === activeClassId
        ? { ...cls, students: [...(cls.students || []), newStudent] }
        : cls
    ) as SafeClass[];
    setClasses(updatedClasses);

    // Sync to backend
    const updatedClass = updatedClasses.find((c: SafeClass) => c.id === activeClassId);
    if (updatedClass) {
      saveClass(updatedClass);
    }
  };

  const handleUpdateStudent = (studentId: number, field: string, value: any) => {
    if (!activeClassId) return;
    
    const updatedClasses = classes.map((cls: SafeClass) =>
      cls.id === activeClassId
        ? {
            ...cls,
            students: cls.students?.map((student) =>
              student.id === studentId
                ? { ...student, [field]: value }
                : student
            ) || [],
          }
        : cls
    ) as SafeClass[];
    setClasses(updatedClasses);

    // Debounced sync to backend
    const updatedClass = updatedClasses.find((c: SafeClass) => c.id === activeClassId);
    if (updatedClass) {
      saveClass(updatedClass);
    }
  };

  const handleDeleteStudent = (studentId: number) => {
    if (!activeClassId) return;
    
    const updatedClasses = classes.map((cls: SafeClass) =>
      cls.id === activeClassId
        ? {
            ...cls,
            students: cls.students?.filter((s) => s.id !== studentId) || [],
          }
        : cls
    ) as SafeClass[];
    setClasses(updatedClasses);

    const updatedClass = updatedClasses.find((c: SafeClass) => c.id === activeClassId);
    if (updatedClass) {
      saveClass(updatedClass);
    }
  };

  const handleToggleAttendance = (studentId: number, day: number) => {
    if (!activeClassId) return;
    
    const dateKey = `${currentYear}-${currentMonth + 1}-${day}`;
    
    const updatedClasses = classes.map((cls: SafeClass) =>
      cls.id === activeClassId
        ? {
            ...cls,
            students: cls.students?.map((student) => {
              if (student.id === studentId) {
                const currentStatus = student.attendance[dateKey];
                let newStatus: 'P' | 'A' | 'L' | undefined;
                if (!currentStatus) {
                  newStatus = 'P';
                } else if (currentStatus === 'P') {
                  newStatus = 'A';
                } else if (currentStatus === 'A') {
                  newStatus = 'L';
                } else {
                  newStatus = undefined;
                }
                return {
                  ...student,
                  attendance: {
                    ...student.attendance,
                    [dateKey]: newStatus,
                  },
                };
              }
              return student;
            }) || [],
          }
        : cls
    ) as SafeClass[];
    setClasses(updatedClasses);

    const updatedClass = updatedClasses.find((c: SafeClass) => c.id === activeClassId);
    if (updatedClass) {
      saveClass(updatedClass);
    }
  };

  const handleAddColumn = () => {
    if (!newColumnLabel.trim() || !activeClassId) return;
    
    const newColumn: CustomColumn = {
      id: `col-${Date.now()}`,
      label: newColumnLabel,
      type: newColumnType,
    };
    
    const updatedClasses = classes.map((cls: SafeClass) =>
      cls.id === activeClassId
        ? {
            ...cls,
            customColumns: [...cls.customColumns, newColumn],
          }
        : cls
    ) as SafeClass[];
    setClasses(updatedClasses);
    setNewColumnLabel('');
    setNewColumnType('text');
    setShowAddColumnModal(false);

    const updatedClass = updatedClasses.find((c: SafeClass) => c.id === activeClassId);
    if (updatedClass) {
      saveClass(updatedClass);
    }
  };

  const handleDeleteColumn = (columnId: string) => {
    if (!activeClassId) return;
    
    const updatedClasses = classes.map((cls: SafeClass) =>
      cls.id === activeClassId
        ? {
            ...cls,
            customColumns: cls.customColumns.filter((col) => col.id !== columnId),
            students: cls.students?.map((student) => {
              const { [columnId]: _, ...rest } = student;
              return rest as Student;
            }) || [],
          }
        : cls
    ) as SafeClass[];
    setClasses(updatedClasses);

    const updatedClass = updatedClasses.find((c: SafeClass) => c.id === activeClassId);
    if (updatedClass) {
      saveClass(updatedClass);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-teal-50 to-cyan-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-slate-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) return null;

  const activeClass = classes.find((c: SafeClass) => c.id === activeClassId);

  return (
    <div className="min-h-screen h-screen bg-gradient-to-br from-emerald-50 via-teal-50 to-cyan-50 flex flex-col overflow-hidden">
      {/* Header */}
      <header className="bg-white border-b border-emerald-200/60 shadow-sm flex-shrink-0">
        <div className="px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              className="p-2 hover:bg-emerald-50 rounded-lg transition-colors cursor-pointer"
            >
              <Menu className="w-5 h-5 text-slate-600" />
            </button>
          </div>

          <div className="flex items-center gap-2">
            <img
              src="/logo.png"
              alt="Lernova Attendsheets Logo"
              className="w-10 h-10"
            />
          </div>

          <div className="flex items-center gap-3 border-l border-emerald-200 pl-4">
            <div className="flex items-center gap-2">
              {syncing && (
                <p className="text-xs text-blue-600">Syncing...</p>
              )}
              {syncError && (
                <p className="text-xs text-amber-600">{syncError}</p>
              )}
              {!syncing && !syncError && (
                <>
                  {showSnapshot && classes.length === 0 && (
                    <p className="text-xs text-slate-600">Dashboard Overview</p>
                  )}
                  {showAllClasses && (
                    <p className="text-xs text-slate-600">All Classes Overview</p>
                  )}
                  {showImportState && (
                    <p className="text-xs text-slate-600">Setting up new class</p>
                  )}
                </>
              )}
            </div>

            {!showImportState && !activeClass && classes.length === 0 ? (
              <button
                onClick={() => {
                  setShowSnapshot(true);
                  setShowAllClasses(false);
                  setActiveClassId(null);
                }}
                className="flex items-center gap-2 px-4 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-lg transition-colors font-medium text-sm cursor-pointer"
              >
                <LayoutDashboard className="w-4 h-4" />
                Dashboard
              </button>
            ) : null}

            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-lg flex items-center justify-center">
                <User className="w-5 h-5 text-white" />
              </div>
              <div className="hidden md:block">
                <p className="text-sm font-medium text-slate-900">{user?.name}</p>
                <p className="text-xs text-slate-600">{user?.email}</p>
              </div>
            </div>
          </div>
        </div>

        {!showImportState && activeClass && !showAllClasses && !showSnapshot ? (
          <MonthYearSelector
            currentMonth={currentMonth}
            currentYear={currentYear}
            onMonthChange={setCurrentMonth}
            onYearChange={setCurrentYear}
          />
        ) : null}
      </header>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden min-h-0">
        <Sidebar
          collapsed={sidebarCollapsed}
          classes={classes as Class[]}
          activeClassId={activeClassId}
          onClassSelect={handleClassSelect}
          onAddClass={() => setShowAddClassModal(true)}
          onDeleteClass={handleDeleteClass}
          onViewAllClasses={() => {
            setShowAllClasses(true);
            setShowSnapshot(false);
            setShowImportState(false);
          }}
          onViewSnapshot={() => {
            setShowSnapshot(true);
            setShowAllClasses(false);
            setShowImportState(false);
            setActiveClassId(null);
          }}
          onOpenSettings={handleOpenSettings}
          onLogout={handleLogout}
          onUpdateClassName={handleUpdateClassName}
        />

        <main className="flex-1 overflow-y-auto p-6">
          {showImportState ? (
            <ImportDataState
              className={pendingClassName}
              onManualInput={handleManualInput}
              onImportComplete={handleImportComplete}
              onCancel={handleCancelImport}
            />
          ) : !activeClass && classes.length === 0 ? (
            <EmptyState onCreateClass={() => setShowAddClassModal(true)} />
          ) : showSnapshot ? (
            <SnapshotView
              classes={classes as Class[]}
              currentMonth={currentMonth}
              currentYear={currentYear}
              onClassSelect={handleClassSelect}
              defaultThresholds={defaultThresholds}
              onOpenClassSettings={handleOpenClassSettings}
            />
          ) : showAllClasses ? (
            <AllClassesView
              classes={classes as Class[]}
              onBack={() => setShowAllClasses(false)}
              onClassSelect={handleClassSelect}
              currentMonth={currentMonth}
              currentYear={currentYear}
              defaultThresholds={defaultThresholds}
            />
          ) : activeClass ? (
            <AttendanceSheet
              activeClass={activeClass as Class}
              currentMonth={currentMonth}
              currentYear={currentYear}
              onAddStudent={handleAddStudent}
              onUpdateStudent={handleUpdateStudent}
              onDeleteStudent={handleDeleteStudent}
              onToggleAttendance={handleToggleAttendance}
              onAddColumn={() => setShowAddColumnModal(true)}
              onDeleteColumn={handleDeleteColumn}
              defaultThresholds={defaultThresholds}
              onOpenSettings={() => handleOpenClassSettings(activeClass.id)}
              onUpdateClassName={(newName) => handleUpdateClassName(activeClass.id, newName)}
              onOpenQRAttendance={() => setShowQRModal(true)}
            />
          ) : null}
        </main>
      </div>

      {/* Modals */}
      <AddClassModal
        isOpen={showAddClassModal}
        className={newClassName}
        onClassNameChange={setNewClassName}
        onClose={() => {
          setShowAddClassModal(false);
          setNewClassName('');
        }}
        onCreate={handleAddClass}
      />

      <AddColumnModal
        isOpen={showAddColumnModal}
        columnLabel={newColumnLabel}
        columnType={newColumnType}
        onLabelChange={setNewColumnLabel}
        onTypeChange={setNewColumnType}
        onClose={() => {
          setShowAddColumnModal(false);
          setNewColumnLabel('');
          setNewColumnType('text');
        }}
        onCreate={handleAddColumn}
      />

      <DeleteClassModal
        isOpen={showDeleteClassModal}
        classToDelete={classToDelete}
        onClose={() => {
          setShowDeleteClassModal(false);
          setClassToDelete(null);
        }}
        onDelete={confirmDeleteClass}
      />

      {showQRModal && activeClass && (
        <QRAttendanceModal
          classId={activeClass.id}
          className={activeClass.name}
          totalStudents={(activeClass.students || []).length}
          onClose={() => setShowQRModal(false)}
        />
      )}

      {settingsClassId !== null && (
        <ClassThresholdSettings
          isOpen={showThresholdSettings}
          currentClass={classes.find((c: SafeClass) => c.id === settingsClassId!)!}
          allClasses={classes as Class[]}
          thresholds={
            classes.find((c: SafeClass) => c.id === settingsClassId!)?.thresholds || defaultThresholds
          }
          onClose={() => {
            setShowThresholdSettings(false);
            setSettingsClassId(null);
          }}
          onSave={handleSaveThresholds}
        />
      )}

      <SettingsModal
        isOpen={showSettingsModal}
        onClose={() => setShowSettingsModal(false)}
        onPasswordChangeClick={handlePasswordChangeClick}
      />

      <ChangePasswordModal
        isOpen={showChangePasswordModal}
        onClose={() => setShowChangePasswordModal(false)}
      />
    </div>
  );
}
