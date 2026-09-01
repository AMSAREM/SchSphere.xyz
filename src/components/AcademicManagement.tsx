import { useState } from 'react';
import React from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type Teacher, type Subject, type ClassInfo } from '../db/schema';
import { Plus, Trash2, Book, GraduationCap, Users, Edit2, Search, Printer } from 'lucide-react';
import { motion } from 'motion/react';
import { cn, triggerPrint } from '../lib/utils';
import { teachersApi, classesApi, subjectsApi } from '../lib/api';

export default function AcademicManagement() {
  const [activeTab, setActiveTab] = useState<'teachers' | 'classes' | 'subjects'>('teachers');
  const settings = useLiveQuery(() => db.settings.toArray()) || [];
  const schoolName = settings.find(s => s.key === 'schoolProfile')?.value?.schoolName || 'ESEPA INTERNATIONAL SCHOOL';

  React.useEffect(() => {
    teachersApi.getAll().catch(() => {});
    classesApi.getAll().catch(() => {});
    subjectsApi.getAll().catch(() => {});
  }, []);

  return (
    <div className="space-y-6">
      {/* Print Only Header */}
      <div className="only-print">
        <h1 className="text-3xl font-black text-slate-900 uppercase tracking-tighter text-center">{schoolName}</h1>
        <div className="mt-2 text-sm font-bold text-slate-600 uppercase tracking-widest flex items-center justify-center gap-4">
          <span>Academic Resources & Staff Records</span>
          <span className="w-1.5 h-1.5 bg-slate-400 rounded-full" />
          <span>Active View: {activeTab.charAt(0).toUpperCase() + activeTab.slice(1)}</span>
          <span className="w-1.5 h-1.5 bg-slate-400 rounded-full" />
          <span>Generated: {new Date().toLocaleDateString()}</span>
        </div>
      </div>

      <div className="flex border-b border-slate-200 overflow-x-auto scrollbar-hide no-scrollbar items-center justify-between print:hidden">
        <div className="flex">
          <button
            onClick={() => setActiveTab('teachers')}
            className={cn(
              "px-6 py-3 font-bold text-sm transition-all border-b-2 whitespace-nowrap shrink-0",
              activeTab === 'teachers' ? "border-indigo-600 text-indigo-600" : "border-transparent text-slate-400 hover:text-slate-600"
            )}
          >
            Teachers
          </button>
          <button
            onClick={() => setActiveTab('classes')}
            className={cn(
              "px-6 py-3 font-bold text-sm transition-all border-b-2 whitespace-nowrap shrink-0",
              activeTab === 'classes' ? "border-indigo-600 text-indigo-600" : "border-transparent text-slate-400 hover:text-slate-600"
            )}
          >
            Classes
          </button>
          <button
            onClick={() => setActiveTab('subjects')}
            className={cn(
              "px-6 py-3 font-bold text-sm transition-all border-b-2 whitespace-nowrap shrink-0",
              activeTab === 'subjects' ? "border-indigo-600 text-indigo-600" : "border-transparent text-slate-400 hover:text-slate-600"
            )}
          >
            Subjects
          </button>
        </div>
        
        <button 
          onClick={triggerPrint}
          className="print:hidden flex items-center gap-2 px-4 py-1.5 mr-4 text-slate-500 hover:text-indigo-600 transition-colors text-xs font-bold"
        >
          <Printer className="w-4 h-4" />
          Print List
        </button>
      </div>

      <motion.div
        key={activeTab}
        initial={{ opacity: 0, x: 10 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.2 }}
      >
        {activeTab === 'teachers' && <TeacherList />}
        {activeTab === 'classes' && <ClassList />}
        {activeTab === 'subjects' && <SubjectList />}
      </motion.div>
    </div>
  );
}

function TeacherList() {
  const [searchTerm, setSearchTerm] = useState('');
  const teachers = useLiveQuery(() => 
    db.teachers.filter(t => 
      t.firstName.toLowerCase().includes(searchTerm.toLowerCase()) || 
      t.lastName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.staffId.toLowerCase().includes(searchTerm.toLowerCase())
    ).toArray(), 
    [searchTerm]
  );
  const classes = useLiveQuery(() => db.classes.toArray());
  const subjects = useLiveQuery(() => db.subjects.toArray());
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTeacher, setEditingTeacher] = useState<Teacher | null>(null);
  const [selectedClasses, setSelectedClasses] = useState<string[]>([]);
  const [selectedSubjects, setSelectedSubjects] = useState<string[]>([]);

  const toggleClass = (className: string) => {
    setSelectedClasses(prev => 
      prev.includes(className) ? prev.filter(c => c !== className) : [...prev, className]
    );
  };

  const toggleSubject = (subjectName: string) => {
    setSelectedSubjects(prev => 
      prev.includes(subjectName) ? prev.filter(s => s !== subjectName) : [...prev, subjectName]
    );
  };

  const openEditModal = (teacher: Teacher) => {
    setEditingTeacher(teacher);
    setSelectedClasses(teacher.assignedClasses || []);
    setSelectedSubjects(teacher.subjects || []);
    setIsModalOpen(true);
  };

  const handleTeacherSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const teacherData = {
      firstName: formData.get('firstName') as string,
      lastName: formData.get('lastName') as string,
      phone: formData.get('phone') as string,
      email: formData.get('email') as string,
      assignedClasses: selectedClasses,
      subjects: selectedSubjects
    };

    if (editingTeacher && editingTeacher.id) {
      await teachersApi.update(editingTeacher.id, {
        ...teacherData,
        staffId: editingTeacher.staffId
      });
    } else {
      const teacher: Teacher = {
        ...teacherData,
        staffId: `TEA-${Date.now().toString().slice(-4)}`,
      };
      await teachersApi.create(teacher);
    }

    setIsModalOpen(false);
    setEditingTeacher(null);
    setSelectedClasses([]);
    setSelectedSubjects([]);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input 
            type="text"
            placeholder="Search teachers..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
          />
        </div>
        <button 
          onClick={() => {
            setEditingTeacher(null);
            setIsModalOpen(true);
            setSelectedClasses([]);
            setSelectedSubjects([]);
          }}
          className="bg-indigo-600 text-white px-4 py-2 rounded-xl flex items-center gap-2 font-bold hover:bg-indigo-700"
        >
          <Plus className="w-4 h-4" /> Add Teacher
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {teachers?.map(teacher => (
          <div key={teacher.id} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex justify-between items-start mb-4">
                <div className="w-12 h-12 bg-indigo-50 rounded-full flex items-center justify-center text-indigo-600 font-bold uppercase">
                  {(teacher.firstName?.[0] || '')}{(teacher.lastName?.[0] || '') || 'T'}
                </div>
                <div className="flex gap-2">
                  <button 
                    onClick={() => openEditModal(teacher)}
                    className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button 
                    onClick={() => teachersApi.delete(teacher.id!)}
                    className="p-1.5 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-all"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <h4 className="font-bold text-slate-900">{teacher.firstName} {teacher.lastName}</h4>
              <p className="text-xs text-slate-400 font-mono mb-2">{teacher.staffId}</p>
              <p className="text-sm text-slate-600 mb-4">{teacher.phone}</p>
              
              {(teacher.assignedClasses || []).length > 0 && (
                <div className="mb-3">
                  <p className="text-[10px] font-black text-slate-400 uppercase mb-1">Assigned Classes</p>
                  <div className="flex flex-wrap gap-1">
                    {teacher.assignedClasses.map(c => (
                      <span key={c} className="px-2 py-0.5 bg-indigo-50 text-indigo-600 text-[10px] font-bold rounded-md">
                        {c}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {(teacher.subjects || []).length > 0 && (
                <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase mb-1">Subjects</p>
                  <div className="flex flex-wrap gap-1">
                    {teacher.subjects.map(s => (
                      <span key={s} className="px-2 py-0.5 bg-slate-100 text-slate-600 text-[10px] font-bold rounded-md">
                        {s}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl p-8 w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl font-bold mb-6 text-slate-800">{editingTeacher ? 'Edit Teacher' : 'Add New Teacher'}</h3>
            <form onSubmit={handleTeacherSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase">First Name</label>
                  <input name="firstName" defaultValue={editingTeacher?.firstName} placeholder="First Name" required className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none" />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase">Last Name</label>
                  <input name="lastName" defaultValue={editingTeacher?.lastName} placeholder="Last Name" required className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase">Phone</label>
                  <input name="phone" defaultValue={editingTeacher?.phone} placeholder="Phone Number" required className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none" />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase">Email</label>
                  <input name="email" type="email" defaultValue={editingTeacher?.email} placeholder="Email Address" className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none" />
                </div>
              </div>

              <div className="space-y-2 pt-2">
                <label className="text-xs font-bold text-slate-500 uppercase">Assign Classes</label>
                <div className="flex flex-wrap gap-2">
                  {classes?.map(cls => (
                    <button
                      key={cls.id}
                      type="button"
                      onClick={() => toggleClass(cls.name)}
                      className={cn(
                        "px-3 py-1.5 rounded-lg text-xs font-bold transition-all border",
                        selectedClasses.includes(cls.name)
                          ? "bg-indigo-600 border-indigo-600 text-white"
                          : "bg-white border-slate-200 text-slate-500 hover:border-indigo-300"
                      )}
                    >
                      {cls.name}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2 pt-2">
                <label className="text-xs font-bold text-slate-500 uppercase">Assign Subjects</label>
                <div className="flex flex-wrap gap-2">
                  {subjects?.map(sub => (
                    <button
                      key={sub.id}
                      type="button"
                      onClick={() => toggleSubject(sub.name)}
                      className={cn(
                        "px-3 py-1.5 rounded-lg text-xs font-bold transition-all border",
                        selectedSubjects.includes(sub.name)
                          ? "bg-indigo-600 border-indigo-600 text-white"
                          : "bg-white border-slate-200 text-slate-500 hover:border-indigo-300"
                      )}
                    >
                      {sub.name}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex gap-4 pt-6">
                <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 py-3 border border-slate-200 rounded-xl font-bold text-slate-600 hover:bg-slate-50 cursor-pointer">Cancel</button>
                <button id="teacher-submit-btn" type="submit" className="flex-1 py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 shadow-lg shadow-indigo-100 cursor-pointer transition-all active:scale-[0.99]">{editingTeacher ? 'Update Teacher' : 'Save Teacher'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function ClassList() {
  const [searchTerm, setSearchTerm] = useState('');
  const classes = useLiveQuery(() => 
    db.classes.filter(c => 
      c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.level.toLowerCase().includes(searchTerm.toLowerCase())
    ).toArray(),
    [searchTerm]
  );
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingClass, setEditingClass] = useState<ClassInfo | null>(null);

  const handleClassSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const clsData = {
      name: formData.get('name') as string,
      level: formData.get('level') as string
    };

    if (editingClass && editingClass.id) {
      await classesApi.update(editingClass.id, clsData);
    } else {
      await classesApi.create(clsData);
    }
    
    setIsModalOpen(false);
    setEditingClass(null);
  };

  const openEditModal = (cls: ClassInfo) => {
    setEditingClass(cls);
    setIsModalOpen(true);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input 
            type="text"
            placeholder="Search classes..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
          />
        </div>
        <button 
          onClick={() => {
            setEditingClass(null);
            setIsModalOpen(true);
          }}
          className="bg-indigo-600 text-white px-4 py-2 rounded-xl flex items-center gap-2 font-bold hover:bg-indigo-700"
        >
          <Plus className="w-4 h-4" /> Add Class
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {classes?.map(cls => (
          <div key={cls.id} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm relative group">
            <GraduationCap className="w-8 h-8 text-indigo-200 mb-2" />
            <h4 className="font-bold text-slate-900 border-b pb-2 mb-2">{cls.name}</h4>
            <p className="text-xs text-indigo-600 font-bold uppercase">{cls.level}</p>
            <div className="absolute top-4 right-4 flex gap-1 opacity-0 group-hover:opacity-100 transition-all">
              <button 
                onClick={() => openEditModal(cls)}
                className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg"
              >
                <Edit2 className="w-3.5 h-3.5" />
              </button>
              <button 
                onClick={() => classesApi.delete(cls.id!)}
                className="p-1.5 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-lg"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl p-8 w-full max-w-md shadow-2xl">
            <h3 className="text-xl font-bold mb-6">{editingClass ? 'Edit Class' : 'Add New Class'}</h3>
            <form onSubmit={handleClassSubmit} className="space-y-4">
              <input name="name" defaultValue={editingClass?.name} placeholder="Class Name (e.g., Primary 1A)" required className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none" />
              <select name="level" defaultValue={editingClass?.level} className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none">
                <option>Lower Primary</option>
                <option>Upper Primary</option>
                <option>Junior High School</option>
                <option>Senior High School</option>
              </select>
              <div className="flex gap-4 pt-4">
                <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 py-2 border border-slate-200 rounded-xl font-bold">Cancel</button>
                <button type="submit" className="flex-1 py-2 bg-indigo-600 text-white rounded-xl font-bold">{editingClass ? 'Update' : 'Save'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function SubjectList() {
  const [searchTerm, setSearchTerm] = useState('');
  const subjects = useLiveQuery(() => {
    const search = (searchTerm || '').toLowerCase().trim();
    return db.subjects.filter(s => {
      if (!s) return false;
      if (!search) return true;
      const name = (s.name || '').toLowerCase();
      const code = (s.code || '').toLowerCase();
      return name.includes(search) || code.includes(search);
    }).toArray();
  }, [searchTerm]);
  const classes = useLiveQuery(() => db.classes.toArray());
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSubject, setEditingSubject] = useState<Subject | null>(null);
  const [selectedClasses, setSelectedClasses] = useState<string[]>([]);
  const [isAllClasses, setIsAllClasses] = useState(true);

  const toggleClass = (className: string) => {
    setSelectedClasses(prev => 
      prev.includes(className) ? prev.filter(c => c !== className) : [...prev, className]
    );
    if (selectedClasses.includes(className) && selectedClasses.length === 1) {
      // If we are removing the last class, we don't automatically go to "All Classes" but the user might want to
    }
    setIsAllClasses(false);
  };

  const openEditModal = (sub: Subject) => {
    setEditingSubject(sub);
    setSelectedClasses((sub.applicableClasses || []).filter(c => c !== 'All'));
    setIsAllClasses(sub.applicableClasses?.includes('All') ?? true);
    setIsModalOpen(true);
  };

  const handleSubjectSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const subData = {
      name: formData.get('name') as string,
      code: formData.get('code') as string,
      applicableClasses: isAllClasses ? ['All'] : selectedClasses
    };

    if (editingSubject && editingSubject.id) {
      await subjectsApi.update(editingSubject.id, subData);
    } else {
      await subjectsApi.create(subData);
    }

    setIsModalOpen(false);
    setEditingSubject(null);
    setSelectedClasses([]);
    setIsAllClasses(true);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input 
            type="text"
            placeholder="Search subjects..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
          />
        </div>
        <button 
          onClick={() => {
            setEditingSubject(null);
            setIsModalOpen(true);
            setSelectedClasses([]);
            setIsAllClasses(true);
          }}
          className="bg-indigo-600 text-white px-4 py-2 rounded-xl flex items-center gap-2 font-bold hover:bg-indigo-700"
        >
          <Plus className="w-4 h-4" /> Add Subject
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {subjects?.map(sub => (
          <div key={sub.id} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-600">
                  <Book className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-bold text-slate-900">{sub.name}</h4>
                  <p className="text-xs text-slate-400 font-mono">{sub.code}</p>
                </div>
              </div>
              <div className="flex gap-2">
                <button 
                  onClick={() => openEditModal(sub)}
                  className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
                <button 
                  onClick={() => subjectsApi.delete(sub.id!)}
                  className="p-1.5 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-all"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
            
            <div className="mt-2">
              <p className="text-[10px] font-black text-slate-400 uppercase mb-1">Applicable Classes</p>
              <div className="flex flex-wrap gap-1">
                {sub.applicableClasses?.includes('All') ? (
                  <span className="px-2 py-0.5 bg-emerald-50 text-emerald-600 text-[10px] font-bold rounded-md">
                    All Classes
                  </span>
                ) : (
                  sub.applicableClasses?.map(c => (
                    <span key={c} className="px-2 py-0.5 bg-slate-100 text-slate-600 text-[10px] font-bold rounded-md">
                      {c}
                    </span>
                  ))
                )}
                {(!sub.applicableClasses || sub.applicableClasses.length === 0) && (
                   <span className="px-2 py-0.5 bg-slate-50 text-slate-400 text-[10px] font-bold rounded-md">
                    Not Assigned
                  </span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl p-8 w-full max-w-md shadow-2xl">
            <h3 className="text-xl font-bold mb-6">{editingSubject ? 'Edit Subject' : 'Add New Subject'}</h3>
            <form onSubmit={handleSubjectSubmit} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase">Subject Name</label>
                <input name="name" defaultValue={editingSubject?.name} placeholder="Subject Name" required className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none" />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase">Subject Code</label>
                <input name="code" defaultValue={editingSubject?.code} placeholder="Subject Code" required className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none" />
              </div>

              <div className="space-y-2 pt-2">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-bold text-slate-500 uppercase">Applicable Classes</label>
                  <button 
                    type="button"
                    onClick={() => {
                      setIsAllClasses(true);
                      setSelectedClasses([]);
                    }}
                    className={cn(
                      "text-[10px] font-bold px-2 py-0.5 rounded",
                      isAllClasses ? "bg-emerald-600 text-white" : "bg-slate-100 text-slate-500"
                    )}
                  >
                    All Classes
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {classes?.map(cls => (
                    <button
                      key={cls.id}
                      type="button"
                      onClick={() => toggleClass(cls.name)}
                      className={cn(
                        "px-3 py-1 text-xs font-bold transition-all border rounded-lg",
                        selectedClasses.includes(cls.name)
                          ? "bg-indigo-600 border-indigo-600 text-white"
                          : "bg-white border-slate-200 text-slate-500 hover:border-indigo-300"
                      )}
                    >
                      {cls.name}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex gap-4 pt-4">
                <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 py-2 border border-slate-200 rounded-xl font-bold text-slate-600">Cancel</button>
                <button type="submit" className="flex-1 py-2 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700">{editingSubject ? 'Update' : 'Save'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
