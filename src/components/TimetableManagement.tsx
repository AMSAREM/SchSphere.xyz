import { useState, useEffect, useMemo } from 'react';
import React from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/schema';
import { 
  Calendar, 
  Clock, 
  Plus, 
  Trash2, 
  Edit2, 
  Printer, 
  Sparkles, 
  AlertTriangle, 
  CheckCircle, 
  Building, 
  Search, 
  CornerDownRight, 
  UserCheck, 
  FileText,
  BookOpen,
  Info
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { triggerPrint } from '../lib/utils';
import { useNotifications } from '../contexts/NotificationContext';
import { useAuth } from '../contexts/AuthContext';

// Standard timetable slot structure
interface TimetableSlot {
  id: string;
  classId: string;       // e.g., "Basic 1"
  subjectName: string;   // e.g., "Mathematics"
  teacherName: string;   // e.g., "Mr. Kwame Boateng"
  day: 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday';
  startTime: string;     // e.g., "08:00"
  endTime: string;       // e.g., "08:45"
  room: string;          // e.g., "Room 3B"
  notes?: string;
}

const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'] as const;

export default function TimetableManagement() {
  const { user } = useAuth();
  const { showToast, confirm } = useNotifications();
  
  // Tab states: View Timetable, Edit Slots, Conflict Diagnostics, Period Suggestions
  const [activeTab, setActiveTab] = useState<'view' | 'class_view' | 'manage' | 'diagnose' | 'suggestions'>('view');
  
  // Selected filter states
  const [selectedClassFilter, setSelectedClassFilter] = useState<string>('All');
  const [selectedTeacherFilter, setSelectedTeacherFilter] = useState<string>('All');
  const [selectedRoomFilter, setSelectedRoomFilter] = useState<string>('All');

  // Class Grid View selection state
  const [selectedClassForGrid, setSelectedClassForGrid] = useState<string>('');
  
  // Form modal states
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingSlotId, setEditingSlotId] = useState<string | null>(null);
  
  // Form input states
  const [formClass, setFormClass] = useState('');
  const [formSubject, setFormSubject] = useState('');
  const [formTeacher, setFormTeacher] = useState('');
  const [formDay, setFormDay] = useState<typeof WEEKDAYS[number]>('Monday');
  const [formStartTime, setFormStartTime] = useState('08:00');
  const [formEndTime, setFormEndTime] = useState('08:45');
  const [formRoom, setFormRoom] = useState('Room A');
  const [formNotes, setFormNotes] = useState('');

  // Settings & DB queries
  const settings = useLiveQuery(() => db.settings.toArray()) || [];
  const schoolName = settings.find(s => s.key === 'schoolProfile')?.value?.schoolName || 'ESEPA INTERNATIONAL SCHOOL';
  
  // Query all database records for select tags
  const teachersInDB = useLiveQuery(() => db.teachers.toArray()) || [];
  const classesInDB = useLiveQuery(() => db.classes.toArray()) || [];
  const subjectsInDB = useLiveQuery(() => db.subjects.toArray()) || [];
  const studentsInDB = useLiveQuery(() => db.students.toArray()) || [];

  const isStudent = user?.role === 'student';
  const isParent = user?.role === 'parent';
  const isTeacher = user?.role === 'teacher';
  const isAdmin = user?.role === 'super_admin' || user?.role === 'admin' || user?.role === 'headteacher';

  // Find student record matching current user's full name to identify their class
  const studentRecord = useMemo(() => {
    if (isStudent && user?.fullName) {
      const cleanName = user.fullName.replace(/\s*\(Student\)/i, '').trim().toLowerCase();
      return studentsInDB.find(s => {
        const full = `${s.firstName} ${s.lastName}`.toLowerCase().trim();
        return full.includes(cleanName) || cleanName.includes(full);
      });
    }
    return null;
  }, [isStudent, user?.fullName, studentsInDB]);

  const studentClass = studentRecord?.class || 'P1';

  // Match current parent user to children/wards
  const parentWards = useMemo(() => {
    if (isParent && user?.fullName && studentsInDB.length > 0) {
      const cleanParentName = user.fullName.replace(/\s*\(Parent\)/i, '').trim().toLowerCase();
      return studentsInDB.filter(s => {
        const guardian = (s.guardianName || '').toLowerCase().trim();
        return guardian.includes(cleanParentName) || cleanParentName.includes(guardian);
      });
    }
    return [];
  }, [isParent, user?.fullName, studentsInDB]);

  const parentWardsClasses = useMemo(() => {
    return Array.from(new Set(parentWards.map(w => w.class))).filter(Boolean);
  }, [parentWards]);

  // Sync class filter and view for student and parent roles
  useEffect(() => {
    if (isStudent) {
      setSelectedClassFilter(studentClass);
      setSelectedClassForGrid(studentClass);
    } else if (isParent && parentWardsClasses.length > 0) {
      setSelectedClassFilter(parentWardsClasses[0]);
      setSelectedClassForGrid(parentWardsClasses[0]);
    }
  }, [isStudent, studentClass, isParent, parentWardsClasses]);

  // Keep non-admins away from admin-only tabs
  useEffect(() => {
    if ((isStudent || isParent || isTeacher) && (activeTab === 'manage' || activeTab === 'diagnose')) {
      setActiveTab('view');
    }
  }, [isStudent, isParent, isTeacher, activeTab]);
  
  // Fetch slots from dexie appsettings (highly resilient, zero migration worries)
  const timetableSetting = settings.find(s => s.key === 'timetable_slots');
  const slots: TimetableSlot[] = listSlotsSorted(timetableSetting?.value || []);

  const suggestionsSetting = settings.find(s => s.key === 'timetable_suggestions');
  const suggestions: any[] = suggestionsSetting?.value || [];

  function listSlotsSorted(arr: TimetableSlot[]): TimetableSlot[] {
    return [...arr].sort((a, b) => {
      const timeDiff = a.startTime.localeCompare(b.startTime);
      if (timeDiff !== 0) return timeDiff;
      return a.day.localeCompare(b.day);
    });
  }

  // Derived filter categories for lookups
  const classesList = useMemo(() => {
    if (isParent) {
      return parentWardsClasses;
    }
    return Array.from(new Set([
      ...classesInDB.map(c => c.name),
      ...studentsInDB.map(s => s.class),
      ...teachersInDB.flatMap(t => t.assignedClasses || []),
      ...slots.map(s => s.classId)
    ])).filter(Boolean).sort();
  }, [isParent, parentWardsClasses, classesInDB, studentsInDB, teachersInDB, slots]);

  const teachersList = Array.from(new Set([
    ...teachersInDB.map(t => `${t.firstName} ${t.lastName}`),
    ...slots.map(s => s.teacherName)
  ])).sort();

  const subjectsList = Array.from(new Set([
    ...subjectsInDB.map(s => s.name),
    ...slots.map(s => s.subjectName)
  ])).sort();

  const roomsList = Array.from(new Set([
    "Room A", "Room B", "Room C", "Science Lab", "ICT Suite", "Library", "Assembly Hall",
    ...slots.map(s => s.room)
  ])).sort();

  // Parse hour/minute into absolute minutes since midnight (important for collision overlaps)
  const toMinutes = (timeStr: string) => {
    const [h, m] = timeStr.split(':').map(Number);
    return (h || 0) * 60 + (m || 0);
  };

  const getTimeSlotsSorted = () => {
    const timeRanges = new Set<string>();
    slots.forEach(s => {
      timeRanges.add(`${s.startTime} - ${s.endTime}`);
    });
    return Array.from(timeRanges).sort((a, b) => {
      const startA = a.split(' - ')[0] || '';
      const startB = b.split(' - ')[0] || '';
      return startA.localeCompare(startB);
    });
  };

  // Helper code to inject demo data on click if database is empty
  const handleSeedSampleData = async () => {
    const defaultSampleSlots: TimetableSlot[] = [
      { id: 'sample-1', classId: 'JHS 1', subjectName: 'Mathematics', teacherName: 'Mr. Kwame Boateng', day: 'Monday', startTime: '08:00', endTime: '09:00', room: 'Room A' },
      { id: 'sample-2', classId: 'JHS 1', subjectName: 'Integrated Science', teacherName: 'Mrs. Janet Antwi', day: 'Monday', startTime: '09:00', endTime: '10:00', room: 'Room A' },
      { id: 'sample-3', classId: 'JHS 1', subjectName: 'Social Studies', teacherName: 'Mr. Kpodo Kafui', day: 'Monday', startTime: '10:30', endTime: '11:30', room: 'Room A' },
      { id: 'sample-4', classId: 'JHS 1', subjectName: 'ICT & Computing', teacherName: 'Mr. John Dumelo', day: 'Monday', startTime: '11:30', endTime: '12:30', room: 'ICT Suite' },
      { id: 'sample-5', classId: 'JHS 2', subjectName: 'Mathematics', teacherName: 'Mr. Kwame Boateng', day: 'Monday', startTime: '09:00', endTime: '10:00', room: 'Room B' },
      { id: 'sample-6', classId: 'JHS 2', subjectName: 'English Language', teacherName: 'Miss Sarah Mensah', day: 'Tuesday', startTime: '08:00', endTime: '09:15', room: 'Room B' },
      { id: 'sample-7', classId: 'JHS 1', subjectName: 'Religious & Moral Educ (RME)', teacherName: 'Rev. Albert Ocran', day: 'Wednesday', startTime: '11:00', endTime: '12:00', room: 'Room A' },
    ];

    const existingSetting = await db.settings.where('key').equals('timetable_slots').first();
    if (existingSetting) {
      await db.settings.update(existingSetting.id!, { value: defaultSampleSlots });
    } else {
      await db.settings.add({ key: 'timetable_slots', value: defaultSampleSlots });
    }

    // Also auto-add classes/subjects if they don't exist in system to make it look full!
    try {
      if (classesInDB.length === 0) {
        await db.classes.add({ name: 'JHS 1', level: 'Junior High School' });
        await db.classes.add({ name: 'JHS 2', level: 'Junior High School' });
        await db.classes.add({ name: 'Class 6', level: 'Primary School' });
      }
      if (subjectsInDB.length === 0) {
        await db.subjects.add({ name: 'Mathematics', code: 'MATH-JHS', applicableClasses: [] });
        await db.subjects.add({ name: 'English Language', code: 'ENG-JHS', applicableClasses: [] });
        await db.subjects.add({ name: 'Integrated Science', code: 'SCI-JHS', applicableClasses: [] });
      }
    } catch (e) {
      console.error(e);
    }

    showToast("Loaded high-quality template school timetable schedule successfully!", "success");
  };

  // Check custom collision logic and diagnostics
  // This engine detects if any slots overlap on the same day for:
  // 1. Same Teacher (the teacher is in two classes simultaneously)
  // 2. Same Class (the class is scheduled with two different subjects simultaneously)
  // 3. Same Room (the physical room is occupied by two classes simultaneously)
  const getCollisions = (allSlots: TimetableSlot[]) => {
    const collisionsList: Array<{
      type: 'Teacher Check' | 'Class Room Conflict' | 'Class Double-Booking';
      slotA: TimetableSlot;
      slotB: TimetableSlot;
      message: string;
    }> = [];

    for (let i = 0; i < allSlots.length; i++) {
      for (let j = i + 1; j < allSlots.length; j++) {
        const a = allSlots[i];
        const b = allSlots[j];

        // Must be on the same weekday to clash
        if (a.day !== b.day) continue;

        const startA = toMinutes(a.startTime);
        const endA = toMinutes(a.endTime);
        const startB = toMinutes(b.startTime);
        const endB = toMinutes(b.endTime);

        // Check if time intervals overlap: (startA < endB) && (startB < endA)
        const overlaps = startA < endB && startB < endA;
        if (!overlaps) continue;

        // Conflict Type 1: Teacher Conflict
        if (a.teacherName === b.teacherName && a.teacherName.trim() !== '') {
          collisionsList.push({
            type: 'Teacher Check',
            slotA: a,
            slotB: b,
            message: `Teacher ${a.teacherName} is assigned to schedule "${a.subjectName}" (${a.classId}) and "${b.subjectName}" (${b.classId}) at the same time: ${a.startTime}-${a.endTime}.`
          });
        }

        // Conflict Type 2: Class Conflict
        if (a.classId === b.classId && a.classId.trim() !== '') {
          collisionsList.push({
            type: 'Class Double-Booking',
            slotA: a,
            slotB: b,
            message: `Classroom "${a.classId}" has overlapping subjects scheduled: "${a.subjectName}" and "${b.subjectName}" from ${Math.max(startA, startB) === startA ? a.startTime : b.startTime}.`
          });
        }

        // Conflict Type 3: Room Occupancy Conflict
        if (a.room === b.room && a.room.trim() !== '') {
          collisionsList.push({
            type: 'Class Room Conflict',
            slotA: a,
            slotB: b,
            message: `Room "${a.room}" is double-booked for "${a.classId} (${a.subjectName})" and "${b.classId} (${b.subjectName})" at the same time.`
          });
        }
      }
    }

    return collisionsList;
  };

  const detectedConflicts = getCollisions(slots);

  // Form Submission
  const handleSaveSlot = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formClass.trim() || !formSubject.trim() || !formTeacher.trim()) {
      showToast("Please fill in the Class, Subject and Teacher fields.", "error");
      return;
    }

    const startMin = toMinutes(formStartTime);
    const endMin = toMinutes(formEndTime);
    if (endMin <= startMin) {
      showToast("The end time must be later than the start time.", "error");
      return;
    }

    if (isTeacher) {
      // Teachers suggest slots - check for collision in the situation of no collision
      const newSlotTemp: TimetableSlot = {
        id: `temp-${Date.now()}`,
        classId: formClass.trim(),
        subjectName: formSubject.trim(),
        teacherName: formTeacher.trim(),
        day: formDay,
        startTime: formStartTime,
        endTime: formEndTime,
        room: formRoom.trim() || 'Room A',
        notes: formNotes.trim()
      };

      const simulatedAllSlots = [...slots, newSlotTemp];
      const newConflicts = getCollisions(simulatedAllSlots);
      const directClashes = newConflicts.filter(c => c.slotA.id === newSlotTemp.id || c.slotB.id === newSlotTemp.id);

      if (directClashes.length > 0) {
        showToast(`Collision overlap detected! Teachers can only suggest slots in the situation of no collision. Conflict details: ${directClashes[0].message}`, "error");
        return;
      }

      const newSuggestion = {
        id: `sug-${Date.now()}`,
        classId: formClass.trim(),
        subjectName: formSubject.trim(),
        teacherName: formTeacher.trim(),
        day: formDay,
        startTime: formStartTime,
        endTime: formEndTime,
        room: formRoom.trim() || 'Room A',
        notes: formNotes.trim(),
        status: 'pending',
        suggestedBy: user?.fullName || 'Teacher',
        createdAt: Date.now()
      };

      const existingSetting = await db.settings.where('key').equals('timetable_suggestions').first();
      const currentSug = existingSetting?.value || [];
      const updatedSug = [...currentSug, newSuggestion];

      if (existingSetting) {
        await db.settings.update(existingSetting.id!, { value: updatedSug });
      } else {
        await db.settings.add({ key: 'timetable_suggestions', value: updatedSug });
      }

      showToast("Period suggestion submitted successfully to Admin!", "success");
      setIsFormOpen(false);
      resetForm();
      setActiveTab('suggestions');
      return;
    }

    const newSlot: TimetableSlot = {
      id: editingSlotId || `slot-${Date.now()}`,
      classId: formClass.trim(),
      subjectName: formSubject.trim(),
      teacherName: formTeacher.trim(),
      day: formDay,
      startTime: formStartTime,
      endTime: formEndTime,
      room: formRoom.trim() || 'Room A',
      notes: formNotes.trim()
    };

    // Calculate conflict check BEFORE adding, to trigger reactive alert popups
    const potentialFutureSlots = slots.filter(s => s.id !== newSlot.id);
    const simulatedAllSlots = [...potentialFutureSlots, newSlot];
    const newConflicts = getCollisions(simulatedAllSlots);
    const directClashes = newConflicts.filter(c => c.slotA.id === newSlot.id || c.slotB.id === newSlot.id);

    if (directClashes.length > 0) {
      const confirmForce = await confirm({
        title: "⚠️ Timetable Slot Overlap Found",
        message: `Scheduling this slot will create ${directClashes.length} collision warning(s) in your timetable:\n\n${directClashes.map(d => `• ${d.message}`).join('\n')}\n\nDo you want to ignore and schedule this slot anyway?`,
        confirmLabel: "Force Add Overlap Cluster"
      });
      if (!confirmForce) return;
    }

    let updatedSlots = [];
    if (editingSlotId) {
      updatedSlots = slots.map(s => s.id === editingSlotId ? newSlot : s);
    } else {
      updatedSlots = [...slots, newSlot];
    }

    const existingSetting = await db.settings.where('key').equals('timetable_slots').first();
    if (existingSetting) {
      await db.settings.update(existingSetting.id!, { value: updatedSlots });
    } else {
      await db.settings.add({ key: 'timetable_slots', value: updatedSlots });
    }

    showToast(editingSlotId ? "Timetable slot updated successfully!" : "New slot added to timetable schedule!", "success");
    setIsFormOpen(false);
    resetForm();
  };

  // Suggestion Actions
  const handleApproveSuggestion = async (sugId: string) => {
    const sug = suggestions.find(s => s.id === sugId);
    if (!sug) return;

    const newSlot: TimetableSlot = {
      id: `slot-${Date.now()}`,
      classId: sug.classId,
      subjectName: sug.subjectName,
      teacherName: sug.teacherName,
      day: sug.day,
      startTime: sug.startTime,
      endTime: sug.endTime,
      room: sug.room,
      notes: sug.notes
    };

    const simulatedAllSlots = [...slots, newSlot];
    const newConflicts = getCollisions(simulatedAllSlots);
    const directClashes = newConflicts.filter(c => c.slotA.id === newSlot.id || c.slotB.id === newSlot.id);

    if (directClashes.length > 0) {
      showToast("Cannot approve: This suggestion has a collision conflict with current active slots!", "error");
      return;
    }

    const updatedSlots = [...slots, newSlot];
    const existingSlotSetting = await db.settings.where('key').equals('timetable_slots').first();
    if (existingSlotSetting) {
      await db.settings.update(existingSlotSetting.id!, { value: updatedSlots });
    } else {
      await db.settings.add({ key: 'timetable_slots', value: updatedSlots });
    }

    const updatedSug = suggestions.map(s => s.id === sugId ? { ...s, status: 'approved' } : s);
    const existingSugSetting = await db.settings.where('key').equals('timetable_suggestions').first();
    if (existingSugSetting) {
      await db.settings.update(existingSugSetting.id!, { value: updatedSug });
    }

    showToast("Suggested period approved and successfully added to the timetable!", "success");
  };

  const handleRejectSuggestion = async (sugId: string) => {
    const updatedSug = suggestions.map(s => s.id === sugId ? { ...s, status: 'rejected' } : s);
    const existingSugSetting = await db.settings.where('key').equals('timetable_suggestions').first();
    if (existingSugSetting) {
      await db.settings.update(existingSugSetting.id!, { value: updatedSug });
    }
    showToast("Suggested period has been rejected.", "info");
  };

  const handleDeleteSuggestion = async (sugId: string) => {
    const updatedSug = suggestions.filter(s => s.id !== sugId);
    const existingSugSetting = await db.settings.where('key').equals('timetable_suggestions').first();
    if (existingSugSetting) {
      await db.settings.update(existingSugSetting.id!, { value: updatedSug });
    }
    showToast("Suggestion deleted.", "success");
  };

  // Reset Edit form state
  const resetForm = () => {
    setEditingSlotId(null);
    setFormClass(classesList[0] || '');
    setFormSubject(subjectsList[0] || '');
    setFormTeacher(teachersList[0] || '');
    setFormDay('Monday');
    setFormStartTime('08:00');
    setFormEndTime('08:45');
    setFormRoom('Room A');
    setFormNotes('');
  };

  const handleEditClick = (slot: TimetableSlot) => {
    setEditingSlotId(slot.id);
    setFormClass(slot.classId);
    setFormSubject(slot.subjectName);
    setFormTeacher(slot.teacherName);
    setFormDay(slot.day);
    setFormStartTime(slot.startTime);
    setFormEndTime(slot.endTime);
    setFormRoom(slot.room);
    setFormNotes(slot.notes || '');
    setIsFormOpen(true);
  };

  const handleDeleteSlot = async (id: string, name: string) => {
    const isOk = await confirm({
      title: "Remove Period Slot?",
      message: `Are you sure you want to remove the scheduled slot for "${name}" from this timetable? This cannot be undone.`,
      confirmLabel: "Delete Slot"
    });
    if (!isOk) return;

    const filtered = slots.filter(s => s.id !== id);
    const existing = await db.settings.where('key').equals('timetable_slots').first();
    if (existing) {
      await db.settings.update(existing.id!, { value: filtered });
    }
    showToast("Class timetable block successfully updated.", "info");
  };

  // Filter slots based on state
  const getFilteredSlots = () => {
    return slots.filter(slot => {
      const matchClass = selectedClassFilter === 'All'
        ? (isParent ? parentWardsClasses.includes(slot.classId) : true)
        : slot.classId === selectedClassFilter;
      const matchTeacher = selectedTeacherFilter === 'All' || slot.teacherName === selectedTeacherFilter;
      const matchRoom = selectedRoomFilter === 'All' || slot.room === selectedRoomFilter;
      return matchClass && matchTeacher && matchRoom;
    });
  };

  const filteredSlots = getFilteredSlots();

  const currentClass = selectedClassForGrid || classesList[0] || '';

  return (
    <div className="space-y-6">
      {/* Printable Only Header */}
      <div className="only-print">
        <h1 className="text-3xl font-black text-slate-900 uppercase tracking-tighter text-center">{schoolName}</h1>
        <p className="mt-1 text-center font-extrabold uppercase text-xs tracking-wider text-slate-500">Official Class & Course Timetable Schedule</p>
        <div className="mt-4 border-t-2 border-slate-900 pt-3 flex flex-wrap justify-between text-xs font-black text-slate-700">
          {activeTab === 'class_view' ? (
            <>
              <span>Selected Class: {currentClass} Grid View</span>
              <span>Layout Type: Weekday Calendar Grid</span>
              <span>Generated: {new Date().toLocaleDateString()}</span>
            </>
          ) : (
            <>
              <span>Active Filter - Class: {selectedClassFilter}</span>
              <span>Teacher Assigned: {selectedTeacherFilter}</span>
              <span>Room / Lab: {selectedRoomFilter}</span>
              <span>Generated: {new Date().toLocaleDateString()}</span>
            </>
          )}
        </div>
      </div>

      {/* Primary Header */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4 print:hidden">
        <div className="space-y-1">
          <h2 className="text-xl font-black text-slate-950 uppercase tracking-wider flex items-center gap-2">
            <Calendar className="w-6 h-6 text-indigo-600" />
            Timetable & Course Scheduler
          </h2>
          <p className="text-xs text-slate-500 font-semibold leading-relaxed">
            Configure school lesson blocks, prevent classroom overlap collisions, and export crisp custom student timetables.
          </p>
        </div>

        {isAdmin && (
          <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto uppercase">
            {slots.length === 0 && (
              <button
                onClick={handleSeedSampleData}
                className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white hover:shadow-md rounded-xl text-xs font-extrabold flex items-center gap-2 transition-all shrink-0"
                title="Prepopulate classrooms and teachers so you don't have to write from scratch"
              >
                <Sparkles className="w-4 h-4" />
                Pre-fill Template
              </button>
            )}

            <button
              onClick={() => {
                resetForm();
                setIsFormOpen(true);
              }}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-extrabold flex items-center gap-2 transition-all shadow-md shadow-indigo-600/10 shrink-0"
            >
              <Plus className="w-4 h-4" />
              Add Time Block
            </button>
          </div>
        )}

        {isTeacher && (
          <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto uppercase">
            <button
              onClick={() => {
                resetForm();
                setIsFormOpen(true);
              }}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-extrabold flex items-center gap-2 transition-all shadow-md shadow-indigo-600/10 shrink-0"
            >
              <Plus className="w-4 h-4" />
              Suggest Period
            </button>
          </div>
        )}
      </div>

      {/* Tabs navigation & Print Action row */}
      <div className="flex border-b border-slate-250 items-center justify-between overflow-x-auto print:hidden">
        <div className="flex gap-4">
          <button
            onClick={() => setActiveTab('view')}
            className={`pb-3 text-xs sm:text-sm font-extrabold tracking-wider uppercase border-b-2 transition-all flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'view' 
                ? 'border-indigo-600 text-indigo-600' 
                : 'border-transparent text-slate-400 hover:text-slate-600'
            }`}
          >
            <Calendar className="w-4 h-4" />
            Grid Week Outlook
          </button>
          <button
            onClick={() => setActiveTab('class_view')}
            className={`pb-3 text-xs sm:text-sm font-extrabold tracking-wider uppercase border-b-2 transition-all flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'class_view' 
                ? 'border-indigo-600 text-indigo-600' 
                : 'border-transparent text-slate-400 hover:text-slate-600'
            }`}
          >
            <Building className="w-4 h-4" />
            Class Grid View
          </button>
          {/* Suggestions tab for Teachers and Admins */}
          {(isTeacher || isAdmin) && (
            <button
              onClick={() => setActiveTab('suggestions')}
              className={`pb-3 text-xs sm:text-sm font-extrabold tracking-wider uppercase border-b-2 transition-all flex items-center gap-2 whitespace-nowrap relative ${
                activeTab === 'suggestions' 
                  ? 'border-indigo-600 text-indigo-600' 
                  : 'border-transparent text-slate-400 hover:text-slate-600'
              }`}
            >
              <Sparkles className="w-4 h-4" />
              Period Suggestions
              {isAdmin && suggestions.filter(s => s.status === 'pending').length > 0 && (
                <span className="absolute -top-1 -right-2 bg-indigo-600 text-white font-black text-[9px] w-4.5 h-4.5 rounded-full flex items-center justify-center animate-pulse">
                  {suggestions.filter(s => s.status === 'pending').length}
                </span>
              )}
            </button>
          )}

          {isAdmin && (
            <>
              <button
                onClick={() => setActiveTab('manage')}
                className={`pb-3 text-xs sm:text-sm font-extrabold tracking-wider uppercase border-b-2 transition-all flex items-center gap-2 whitespace-nowrap ${
                  activeTab === 'manage' 
                    ? 'border-indigo-600 text-indigo-600' 
                    : 'border-transparent text-slate-400 hover:text-slate-600'
                }`}
              >
                <Edit2 className="w-4 h-4" />
                All Slots ({slots.length})
              </button>
              <button
                onClick={() => setActiveTab('diagnose')}
                className={`pb-3 text-xs sm:text-sm font-extrabold tracking-wider uppercase border-b-2 transition-all flex items-center gap-2 whitespace-nowrap relative ${
                  activeTab === 'diagnose' 
                    ? 'border-indigo-600 text-indigo-600' 
                    : 'border-transparent text-slate-400 hover:text-slate-600'
                }`}
              >
                <AlertTriangle className="w-4 h-4" />
                Collision Checker
                {detectedConflicts.length > 0 && (
                  <span className="absolute -top-1 -right-2 bg-red-500 text-white font-black text-[9px] w-4.5 h-4.5 rounded-full flex items-center justify-center animate-pulse">
                    {detectedConflicts.length}
                  </span>
                )}
              </button>
            </>
          )}
        </div>

        <button 
          onClick={triggerPrint}
          className="ml-4 mb-2 flex items-center gap-2 px-3.5 py-1.5 bg-indigo-50 border border-indigo-200 text-indigo-700 hover:bg-indigo-100 hover:text-indigo-800 rounded-xl text-[10px] sm:text-xs font-black uppercase tracking-wider transition-all active:scale-95 shadow-sm whitespace-nowrap outline-none focus:ring-2 focus:ring-indigo-500/20"
        >
          <Printer className="w-3.5 h-3.5 text-indigo-600" />
          Print Timetable
        </button>
      </div>

      {/* Grid view layout Filter Row */}
      {activeTab === 'view' && (
        <div className={`bg-slate-50 border border-slate-200 rounded-xl p-4 gap-4 grid grid-cols-1 ${(isStudent || isParent) ? 'max-w-md' : 'sm:grid-cols-3'} print:hidden`}>
          <div className="space-y-1">
            <label className="text-[10px] font-black uppercase text-slate-500 tracking-wider">Filter By Class</label>
            {isStudent ? (
              <div className="w-full border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-black text-indigo-700 bg-indigo-50/50 flex items-center gap-1.5">
                🏫 {studentClass} (My Class)
              </div>
            ) : isParent ? (
              classesList.length <= 1 ? (
                <div className="w-full border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-black text-indigo-700 bg-indigo-50/50 flex items-center gap-1.5">
                  🏫 {classesList[0] || 'No Ward Class'} (My Ward's Class)
                </div>
              ) : (
                <select
                  value={selectedClassFilter}
                  onChange={(e) => setSelectedClassFilter(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-semibold text-slate-800 bg-white"
                >
                  <option value="All">🏫 All My Wards' Classes</option>
                  {classesList.map(cls => (
                    <option key={cls} value={cls}>{cls}</option>
                  ))}
                </select>
              )
            ) : (
              <select
                value={selectedClassFilter}
                onChange={(e) => setSelectedClassFilter(e.target.value)}
                className="w-full border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-semibold text-slate-800 bg-white"
              >
                <option value="All">🏫 All Classes / Grades</option>
                {classesList.map(cls => (
                  <option key={cls} value={cls}>{cls}</option>
                ))}
              </select>
            )}
          </div>

          {!isStudent && !isParent && (
            <>
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase text-slate-500 tracking-wider">Filter By Teacher</label>
                <select
                  value={selectedTeacherFilter}
                  onChange={(e) => setSelectedTeacherFilter(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-semibold text-slate-800 bg-white"
                >
                  <option value="All">👨‍🏫 All Teachers</option>
                  {teachersList.map(tch => (
                    <option key={tch} value={tch}>{tch}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase text-slate-500 tracking-wider">Filter By Room/Space</label>
                <select
                  value={selectedRoomFilter}
                  onChange={(e) => setSelectedRoomFilter(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-semibold text-slate-800 bg-white"
                >
                  <option value="All">🏢 All Buildings / Rooms</option>
                  {roomsList.map(rm => (
                    <option key={rm} value={rm}>{rm}</option>
                  ))}
                </select>
              </div>
            </>
          )}
        </div>
      )}

      {/* Visual content panes */}
      <div className="print:block">

        {/* Tab 1: Weekly Grid Map View */}
        {activeTab === 'view' && (
          <div className="space-y-4">
            {filteredSlots.length === 0 ? (
              <div className="bg-white border border-slate-200 rounded-2xl p-16 text-center space-y-3 shadow-sm print:hidden">
                <Calendar className="w-12 h-12 text-slate-300 mx-auto" />
                <h4 className="text-md font-black text-slate-800 uppercase tracking-wider">No matching classes scheduled</h4>
                <p className="text-xs text-slate-500 max-w-[400px] mx-auto font-semibold">
                  There are no time blocks matching your current filters. Select "All Classes" or click "Add Time Block" above to get started.
                </p>
                {slots.length === 0 && (
                  <button
                    onClick={handleSeedSampleData}
                    className="mt-2 text-xs font-bold px-4 py-2 bg-indigo-50 border border-indigo-200 text-indigo-700 rounded-lg hover:bg-indigo-100 uppercase"
                  >
                    Use Sample School Data Seeder
                  </button>
                )}
              </div>
            ) : (
              <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden overflow-x-auto min-w-full">
                <table className="w-full border-collapse text-left text-xs text-slate-700 min-w-[700px] table-fixed">
                  <thead>
                    <tr className="bg-slate-50/50 border-b border-slate-100 text-[10px] uppercase font-black text-slate-500 tracking-widest">
                      <th className="p-4 w-[120px]">Weekday</th>
                      <th className="p-4">Period Blocks Scheduled</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100/80 font-semibold">
                    {WEEKDAYS.map((day) => {
                      const daySlots = filteredSlots.filter(s => s.day === day);
                      return (
                        <tr key={day} className="hover:bg-slate-50/20 transition-colors align-top">
                          <td className="p-4 font-black uppercase text-slate-800 tracking-widest text-[11px] bg-slate-50/20">
                            {day}
                            <span className="block font-medium text-[9px] text-indigo-500 lowercase mt-0.5">
                              ({daySlots.length} blocks)
                            </span>
                          </td>
                          <td className="p-4">
                            {daySlots.length === 0 ? (
                              <span className="text-slate-400 italic font-medium block py-2 text-[11px]">
                                No periods scheduled for {day}s
                              </span>
                            ) : (
                              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 print:grid-cols-2">
                                {daySlots.map(slot => (
                                  <div 
                                    key={slot.id} 
                                    className="p-3 bg-gradient-to-br from-indigo-50/30 to-slate-50/40 rounded-xl border border-indigo-100/50 hover:border-indigo-200/80 hover:shadow-sm transition-all relative flex flex-col justify-between"
                                  >
                                    <div>
                                      <div className="flex items-center justify-between gap-1 mb-1">
                                        <div className="inline-flex items-center gap-1 bg-white border border-slate-100 rounded px-1.5 py-0.5 text-[9px] font-black text-slate-700 uppercase">
                                          <Clock className="w-2.5 h-2.5 text-indigo-500" />
                                          {slot.startTime} - {slot.endTime}
                                        </div>
                                        <span className="text-[9px] font-extrabold px-1.5 bg-indigo-100/60 text-indigo-800 rounded">
                                          {slot.classId}
                                        </span>
                                      </div>

                                      <h5 className="font-extrabold text-slate-900 text-[13px] leading-tight">
                                        {slot.subjectName}
                                      </h5>
                                      <p className="text-[10px] text-slate-500 font-extrabold mt-1 flex items-center gap-1">
                                        👩‍🏫 {slot.teacherName}
                                      </p>
                                    </div>

                                    <div className="mt-2.5 pt-2 border-t border-indigo-50 flex items-center justify-between text-[9px] font-bold text-slate-400">
                                      <span className="flex items-center gap-0.5 bg-slate-100 text-slate-600 px-1 rounded">
                                        🏫 {slot.room}
                                      </span>
                                      {slot.notes && (
                                        <span className="truncate max-w-[80px]" title={slot.notes}>
                                          📝 {slot.notes}
                                        </span>
                                      )}
                                    </div>
                                    
                                    {/* Action button triggers inside grid */}
                                    {!isStudent && (
                                      <div className="absolute top-1.5 right-1.5 flex gap-1 opacity-0 hover:opacity-100 group-hover:opacity-100 transition-opacity print:hidden">
                                        <button
                                          onClick={() => handleEditClick(slot)}
                                          className="p-1 bg-white border border-slate-100 rounded text-slate-600 hover:text-indigo-600 hover:shadow-sm"
                                        >
                                          <Edit2 className="w-2.5 h-2.5" />
                                        </button>
                                      </div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Tab: Class Timetable Grid View */}
        {activeTab === 'class_view' && (
          <div className="space-y-6">
            {classesList.length === 0 ? (
              <div className="bg-white border border-slate-205 rounded-2xl p-16 text-center space-y-3 shadow-sm print:hidden">
                <Building className="w-12 h-12 text-slate-300 mx-auto" />
                <h4 className="text-md font-black text-slate-800 uppercase tracking-wider">No classes registered in the system</h4>
                <p className="text-xs text-slate-500 max-w-[400px] mx-auto font-semibold">
                  To view timetables by class, please create classes or click "Pre-fill Template" above.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Horizontal Class Picker Pills */}
                {!isStudent && !isParent ? (
                  <div className="flex flex-wrap items-center gap-2 print:hidden bg-slate-50 p-3 rounded-2xl border border-slate-200">
                    <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider mr-2">Select Class:</span>
                    <div className="flex flex-wrap gap-1.5">
                      {classesList.map(cls => (
                        <button
                          key={cls}
                          onClick={() => setSelectedClassForGrid(cls)}
                          className={`px-3.5 py-1.5 rounded-xl text-xs font-extrabold transition-all duration-150 uppercase tracking-wider border ${
                            currentClass === cls
                              ? 'bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-600/10'
                              : 'bg-white hover:bg-slate-50 text-slate-600 border-slate-200'
                          }`}
                        >
                          🏫 {cls}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : isParent ? (
                  <div className="space-y-3">
                    <div className="bg-indigo-50/40 border border-indigo-100/70 p-3 rounded-2xl text-xs text-indigo-950 font-extrabold tracking-wide flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <span className="flex items-center gap-1.5">
                        👪 Showing Timetable for My Ward(s): <b className="text-indigo-700 bg-white border border-indigo-100 px-2 py-0.5 rounded-lg text-xs uppercase tracking-wide">{parentWards.length > 0 ? parentWards.map(w => `${w.firstName} (${w.class})`).join(', ') : 'None'}</b>
                      </span>
                      <span className="text-[10px] text-indigo-400 font-bold uppercase tracking-wider">🔒 Protected Parent Access</span>
                    </div>
                    {classesList.length > 1 && (
                      <div className="flex flex-wrap items-center gap-2 print:hidden bg-slate-50 p-3 rounded-2xl border border-slate-200">
                        <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider mr-2">Select Ward's Class:</span>
                        <div className="flex flex-wrap gap-1.5">
                          {classesList.map(cls => (
                            <button
                              key={cls}
                              onClick={() => setSelectedClassForGrid(cls)}
                              className={`px-3.5 py-1.5 rounded-xl text-xs font-extrabold transition-all duration-150 uppercase tracking-wider border ${
                                currentClass === cls
                                  ? 'bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-600/10'
                                  : 'bg-white hover:bg-slate-50 text-slate-600 border-slate-200'
                              }`}
                            >
                              🏫 {cls}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="bg-indigo-50/40 border border-indigo-100/70 p-3 rounded-2xl text-xs text-indigo-950 font-extrabold tracking-wide flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      🏫 Showing Timetable for My Class: <b className="text-indigo-700 bg-white border border-indigo-100 px-2 py-0.5 rounded-lg text-xs uppercase tracking-wide">{studentClass}</b>
                    </span>
                    <span className="text-[10px] text-indigo-400 font-bold uppercase tracking-wider">🔒 Standard Student Access</span>
                  </div>
                )}

                {/* Main Class Weekly Grid Calendar */}
                {getTimeSlotsSorted().length === 0 ? (
                  <div className="bg-white border border-slate-200 rounded-2xl p-16 text-center space-y-3 shadow-sm">
                    <Calendar className="w-12 h-12 text-slate-300 mx-auto" />
                    <h4 className="text-md font-black text-slate-800 uppercase tracking-wider">No Scheduled Periods for Class {currentClass}</h4>
                    <p className="text-xs text-slate-500 max-w-[420px] mx-auto font-semibold">
                      This class does not have any weekly lesson periods scheduled yet. Click "Add Time Block" above to begin scheduling.
                    </p>
                  </div>
                ) : (
                  <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden overflow-x-auto min-w-full">
                    <div className="p-4 bg-slate-50/50 border-b border-slate-100 flex items-center justify-between">
                      <h4 className="text-xs font-black text-indigo-950 uppercase tracking-widest flex items-center gap-1.5">
                        <Building className="w-4 h-4 text-indigo-500" />
                        Class: {currentClass} Timetable Matrix
                      </h4>
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                        {slots.filter(s => s.classId === currentClass).length} Periods Total
                      </p>
                    </div>

                    <table className="w-full border-collapse text-left text-xs text-slate-700 min-w-[800px] table-fixed">
                      <thead>
                        <tr className="bg-slate-50/30 border-b border-slate-100 text-[10px] uppercase font-black text-slate-500 tracking-widest">
                          <th className="p-4 w-[130px] border-r border-slate-100 text-indigo-600 bg-slate-50/40">Time Period</th>
                          {WEEKDAYS.map(day => (
                            <th key={day} className="p-4 text-center border-r border-slate-100 last:border-r-0">
                              {day}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {getTimeSlotsSorted().map(timeRange => {
                          const [startTime, endTime] = timeRange.split(' - ');
                          return (
                            <tr key={timeRange} className="hover:bg-slate-50/10 align-top">
                              {/* Left-most Time Block Identifier */}
                              <td className="p-4 font-black uppercase text-slate-800 border-r border-slate-100 bg-slate-50/40">
                                <span className="block text-indigo-600 font-black text-[12px] tracking-tight">{startTime}</span>
                                <span className="block text-slate-400 text-[9px] font-bold tracking-wider mt-0.5">to {endTime}</span>
                              </td>

                              {/* Weekdays Grid Slots */}
                              {WEEKDAYS.map(day => {
                                const matchedSlots = slots.filter(s => 
                                  s.classId === currentClass && 
                                  s.day === day && 
                                  s.startTime === startTime && 
                                  s.endTime === endTime
                                );

                                return (
                                  <td key={day} className="p-2 border-r border-slate-100 last:border-r-0 relative group min-h-[95px]">
                                    {matchedSlots.length === 0 ? (
                                      /* Unscheduled Slot action link */
                                      (isStudent || isParent) ? (
                                        <div className="w-full h-full min-h-[75px] flex items-center justify-center border border-dashed border-slate-100 rounded-xl bg-slate-50/30">
                                          <span className="text-[10px] text-slate-400 font-bold tracking-wide italic">Free Period</span>
                                        </div>
                                      ) : (
                                        <button
                                          onClick={() => {
                                            setFormClass(currentClass);
                                            setFormDay(day);
                                            setFormStartTime(startTime);
                                            setFormEndTime(endTime);
                                            setFormRoom('Room A');
                                            setFormNotes('');
                                            setEditingSlotId(null);
                                            setIsFormOpen(true);
                                          }}
                                          className="w-full h-full min-h-[75px] flex flex-col items-center justify-center border border-dashed border-slate-200 hover:border-indigo-200 hover:bg-indigo-50/10 rounded-xl transition-all duration-150 group/btn"
                                        >
                                          <Plus className="w-4 h-4 text-slate-300 group-hover/btn:text-indigo-500 hover:scale-110 transition-all" />
                                          <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                            {isTeacher ? 'Suggest Period' : 'Add Period'}
                                          </span>
                                        </button>
                                      )
                                    ) : (
                                      <div className="space-y-2">
                                        {matchedSlots.map(slot => (
                                          <div
                                            key={slot.id}
                                            className="p-2.5 rounded-xl border bg-gradient-to-br from-indigo-50/20 to-slate-50/30 border-indigo-100/65 hover:border-indigo-200 hover:shadow-xs transition-all relative"
                                          >
                                            <h5 className="font-extrabold text-slate-900 text-[11px] leading-snug truncate" title={slot.subjectName}>
                                              {slot.subjectName}
                                            </h5>
                                            
                                            <div className="mt-1 text-[9px] font-bold text-slate-500 space-y-0.5">
                                              <p className="truncate">👨‍🏫 {slot.teacherName}</p>
                                              <p className="text-indigo-600 font-black tracking-tight bg-indigo-50/55 px-1 rounded inline-block">
                                                🏫 {slot.room}
                                              </p>
                                            </div>

                                            {/* Hover micro-action overlays */}
                                            {isAdmin && (
                                              <div className="absolute top-1 right-1 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity print:hidden">
                                                <button
                                                  onClick={() => handleEditClick(slot)}
                                                  className="p-1 bg-white border border-slate-100 rounded hover:text-indigo-600 text-slate-400 hover:shadow-sm"
                                                  title="Edit Period"
                                                >
                                                  <Edit2 className="w-2.5 h-2.5" />
                                                </button>
                                                <button
                                                  onClick={() => handleDeleteSlot(slot.id, `${slot.subjectName} (${slot.classId})`)}
                                                  className="p-1 bg-white border border-slate-100 rounded hover:text-red-500 text-slate-400 hover:shadow-sm"
                                                  title="Delete Period"
                                                >
                                                  <Trash2 className="w-2.5 h-2.5" />
                                                </button>
                                              </div>
                                            )}
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                  </td>
                                );
                              })}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Manage List View Mode */}
        {activeTab === 'manage' && (
          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
            <div className="p-4 bg-slate-50/50 border-b border-slate-100 flex items-center justify-between">
              <h4 className="text-xs font-black text-slate-950 uppercase tracking-widest">School Wide Time Slots Directory</h4>
              <p className="text-[10px] text-slate-500 font-bold uppercase">{slots.length} Total Registered Slots</p>
            </div>

            {slots.length === 0 ? (
              <div className="p-16 text-center space-y-3">
                <Calendar className="w-12 h-12 text-slate-300 mx-auto" />
                <h5 className="font-black text-slate-800 text-sm uppercase">Timetable Is Empty</h5>
                <p className="text-xs text-slate-500 max-w-sm mx-auto font-medium">Configure recurring lesson blocks and classes to fill school records.</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100 overflow-x-auto">
                <table className="w-full text-left text-xs font-semibold text-slate-700 min-w-[700px]">
                  <thead>
                    <tr className="bg-slate-55 bg-slate-50/40 text-[9px] uppercase tracking-wider font-extrabold text-slate-400 border-b border-slate-100">
                      <th className="p-3">Class/Grade</th>
                      <th className="p-3">Subject</th>
                      <th className="p-3">Teacher Roster</th>
                      <th className="p-3">Schedule Time</th>
                      <th className="p-3">Assigned Room</th>
                      <th className="p-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {slots.map(slot => (
                      <tr key={slot.id} className="hover:bg-slate-50/40 border-b border-slate-100/50">
                        <td className="p-3">
                          <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 border border-indigo-100 rounded-md text-[10px] font-black">
                            {slot.classId}
                          </span>
                        </td>
                        <td className="p-3 font-extrabold text-slate-900">{slot.subjectName}</td>
                        <td className="p-3 text-slate-500 flex items-center gap-1.5 py-4">
                          <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center font-bold text-[10px] text-slate-500">
                            {slot.teacherName.charAt(0)}
                          </div>
                          {slot.teacherName}
                        </td>
                        <td className="p-3">
                          <span className="text-indigo-600 font-extrabold text-[11px]">
                            {slot.day}s, {slot.startTime} - {slot.endTime}
                          </span>
                        </td>
                        <td className="p-3 text-slate-500">{slot.room}</td>
                        <td className="p-3">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => handleEditClick(slot)}
                              className="p-1.5 bg-slate-100 hover:bg-slate-200 rounded text-slate-600 hover:text-indigo-600 transition-colors"
                              title="Edit Block"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteSlot(slot.id, `${slot.subjectName} (${slot.classId})`)}
                              className="p-1.5 bg-slate-100 hover:bg-red-50 hover:border-red-200 rounded text-slate-400 hover:text-red-500 transition-colors"
                              title="Delete Block"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Tab: Period Suggestions */}
        {activeTab === 'suggestions' && (
          <div className="space-y-6">
            <div className="p-6 bg-white border border-slate-200 rounded-2xl shadow-sm flex flex-col md:flex-row items-center justify-between gap-6">
              <div className="space-y-1 text-center md:text-left">
                <h4 className="text-sm font-black text-slate-900 uppercase tracking-widest flex items-center justify-center md:justify-start gap-2">
                  <Sparkles className="w-5 h-5 text-indigo-600" />
                  Lesson Period Suggestions
                </h4>
                <p className="text-xs text-slate-500 font-semibold max-w-[550px]">
                  {isAdmin 
                    ? "Review period requests submitted by teachers. Approved slots will automatically be merged into the active timetable if no collision occurs."
                    : "Suggest recurring period slots directly. Suggestions are verified against existing active slots to avoid scheduling clashes."
                  }
                </p>
              </div>

              {isTeacher && (
                <button
                  onClick={() => {
                    resetForm();
                    setIsFormOpen(true);
                  }}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-extrabold flex items-center gap-2 transition-all shadow-md shadow-indigo-600/10 shrink-0 uppercase tracking-wider"
                >
                  <Plus className="w-4 h-4" />
                  Suggest New Period
                </button>
              )}
            </div>

            {suggestions.length === 0 ? (
              <div className="bg-white border border-slate-200 rounded-2xl p-16 text-center space-y-3 shadow-sm">
                <Sparkles className="w-12 h-12 text-slate-300 mx-auto" />
                <h5 className="font-black text-slate-800 text-sm uppercase">No Suggestions Logged</h5>
                <p className="text-xs text-slate-500 max-w-sm mx-auto font-medium">
                  {isAdmin ? "No teacher has submitted any lesson block suggestions yet." : "You haven't submitted any slot suggestions yet. Click the button above to suggest one!"}
                </p>
              </div>
            ) : (
              <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
                <div className="p-4 bg-slate-50/50 border-b border-slate-100 flex items-center justify-between">
                  <h4 className="text-xs font-black text-indigo-950 uppercase tracking-widest">
                    {isAdmin ? "All Staff Requests" : "My Suggestion Log"}
                  </h4>
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">
                    {isAdmin ? `${suggestions.filter(s => s.status === 'pending').length} pending` : `${suggestions.length} total suggestions`}
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs font-semibold text-slate-700 min-w-[800px]">
                    <thead>
                      <tr className="bg-slate-50/30 text-[9px] uppercase tracking-wider font-extrabold text-slate-400 border-b border-slate-100">
                        <th className="p-4">Suggested By</th>
                        <th className="p-4">Target Class</th>
                        <th className="p-4">Subject & Room</th>
                        <th className="p-4">Requested Time</th>
                        <th className="p-4">Conflict Status</th>
                        <th className="p-4">Status</th>
                        {isAdmin && <th className="p-4 text-right">Actions</th>}
                        {!isAdmin && <th className="p-4 text-right">Options</th>}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {suggestions
                        .filter(sug => isAdmin || sug.suggestedBy === user?.fullName)
                        .map(sug => {
                          const tempSlot = { id: sug.id, ...sug };
                          const currentConflicts = getCollisions([...slots, tempSlot]);
                          const hasClash = currentConflicts.some(c => c.slotA.id === sug.id || c.slotB.id === sug.id);
                          const clashInfo = currentConflicts.find(c => c.slotA.id === sug.id || c.slotB.id === sug.id);

                          return (
                            <tr key={sug.id} className="hover:bg-slate-50/20 align-middle">
                              <td className="p-4 font-bold text-slate-900">{sug.suggestedBy}</td>
                              <td className="p-4">
                                <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 border border-indigo-100 rounded-md text-[10px] font-black uppercase">
                                  {sug.classId}
                                </span>
                              </td>
                              <td className="p-4">
                                <div className="font-extrabold text-slate-800">{sug.subjectName}</div>
                                <div className="text-[10px] text-indigo-600 font-bold mt-0.5">🏫 {sug.room}</div>
                              </td>
                              <td className="p-4">
                                <span className="text-slate-900 font-extrabold">
                                  {sug.day}
                                </span>
                                <div className="text-[10px] text-slate-500 font-bold mt-0.5">{sug.startTime} - {sug.endTime}</div>
                              </td>
                              <td className="p-4">
                                {sug.status !== 'pending' ? (
                                  <span className="text-slate-400 italic text-[11px]">-</span>
                                ) : hasClash ? (
                                  <div className="text-red-600 text-[10px] max-w-[200px] leading-relaxed flex items-start gap-1">
                                    <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-red-500 mt-0.5" />
                                    <span>{clashInfo?.message || 'Collision Overlap Detected'}</span>
                                  </div>
                                ) : (
                                  <div className="text-emerald-600 text-[10px] flex items-center gap-1">
                                    <CheckCircle className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                                    <span>✓ No collisions found</span>
                                  </div>
                                )}
                              </td>
                              <td className="p-4">
                                <span className={`px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-wide border ${
                                  sug.status === 'approved'
                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                    : sug.status === 'rejected'
                                    ? 'bg-rose-50 text-rose-700 border-rose-200'
                                    : 'bg-amber-50 text-amber-700 border-amber-200'
                                }`}>
                                  {sug.status}
                                </span>
                              </td>
                              {isAdmin && (
                                <td className="p-4 text-right">
                                  {sug.status === 'pending' ? (
                                    <div className="flex items-center justify-end gap-1.5 uppercase text-[9px] font-black tracking-wider">
                                      <button
                                        onClick={() => handleApproveSuggestion(sug.id)}
                                        disabled={hasClash}
                                        className={`px-2.5 py-1.5 rounded-lg border flex items-center gap-1 shadow-xs transition-all ${
                                          hasClash
                                            ? 'bg-slate-50 text-slate-400 border-slate-200 cursor-not-allowed'
                                            : 'bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-600 hover:shadow-emerald-600/10'
                                        }`}
                                      >
                                        <CheckCircle className="w-3.5 h-3.5" />
                                        Approve
                                      </button>
                                      <button
                                        onClick={() => handleRejectSuggestion(sug.id)}
                                        className="px-2.5 py-1.5 bg-white border border-slate-200 hover:bg-rose-50 hover:border-rose-150 rounded-lg text-slate-500 hover:text-rose-600 transition-all"
                                      >
                                        Reject
                                      </button>
                                    </div>
                                  ) : (
                                    <button
                                      onClick={() => handleDeleteSuggestion(sug.id)}
                                      className="p-1.5 bg-slate-50 hover:bg-rose-50 rounded text-slate-400 hover:text-rose-600 transition-all border border-transparent hover:border-rose-100"
                                      title="Delete Suggestion Record"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  )}
                                </td>
                              )}
                              {!isAdmin && (
                                <td className="p-4 text-right">
                                  <button
                                    onClick={() => handleDeleteSuggestion(sug.id)}
                                    className="p-1.5 bg-slate-50 hover:bg-rose-50 rounded text-slate-400 hover:text-rose-600 transition-all border border-transparent hover:border-rose-100"
                                    title="Delete My Suggestion"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </td>
                              )}
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Tab 3: Interactive Double Booking / Collision Checker */}
        {activeTab === 'diagnose' && (
          <div className="space-y-6">
            {/* Quick overview metric */}
            <div className="p-6 bg-white border border-slate-200 rounded-2xl shadow-sm flex flex-col md:flex-row items-center justify-between gap-6">
              <div className="space-y-1 text-center md:text-left">
                <h4 className="text-sm font-black text-slate-900 uppercase tracking-widest flex items-center justify-center md:justify-start gap-2">
                  <UserCheck className="w-5 h-5 text-indigo-600" />
                  School Schedule Diagnostics
                </h4>
                <p className="text-xs text-slate-500 font-semibold max-w-[550px]">
                  The schedule engine analyses overlapping times. No teacher, class, or room should be in two places at once.
                </p>
              </div>

              <div className="bg-slate-50/50 border border-slate-200 rounded-xl p-3 px-6 text-center shrink-0">
                <span className="block text-2xl font-black text-slate-900">
                  {detectedConflicts.length}
                </span>
                <span className="text-[10px] font-black uppercase text-slate-500 tracking-wider">
                  Conflicts Found
                </span>
              </div>
            </div>

            {detectedConflicts.length === 0 ? (
              <div className="bg-emerald-50/30 border border-emerald-100 rounded-2xl p-12 text-center space-y-3 shadow-sm">
                <CheckCircle className="w-12 h-12 text-emerald-500 mx-auto" />
                <h4 className="text-md font-black text-emerald-800 uppercase tracking-wider">Perfect Alignment!</h4>
                <p className="text-xs text-slate-600 font-semibold max-w-[420px] mx-auto">
                  Your timetable structure is 100% collision free. There are no overlapping hours for teachers, classes, or rooms.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {detectedConflicts.map((c, idx) => (
                  <div 
                    key={idx}
                    className="p-4 bg-red-50/50 border border-red-100 rounded-2xl hover:shadow-sm transition-all flex flex-col sm:flex-row items-start gap-4"
                  >
                    <div className="p-2.5 bg-red-100 text-red-700 rounded-xl shrink-0 mt-0.5">
                      <AlertTriangle className="w-5 h-5" />
                    </div>
                    <div className="space-y-1.5 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 bg-red-100 text-red-800 rounded text-[9px] font-black uppercase">
                          {c.type}
                        </span>
                        <span className="text-[11px] font-black text-slate-600">
                          Overlapping {c.slotA.day} Schedule
                        </span>
                      </div>
                      
                      <p className="text-xs text-slate-900 font-extrabold leading-relaxed">
                        {c.message}
                      </p>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-3 bg-white p-3 border border-red-100/50 rounded-xl">
                        {/* Slot A details */}
                        <div className="text-[11px] space-y-0.5">
                          <span className="text-slate-400 font-bold block uppercase text-[9px]">Class Period A</span>
                          <span className="font-extrabold text-slate-800">{c.slotA.subjectName} ({c.slotA.classId})</span>
                          <span className="block text-slate-500">Teacher: {c.slotA.teacherName}</span>
                          <span className="block text-indigo-600 font-bold">Time: {c.slotA.startTime} - {c.slotA.endTime}</span>
                          <span className="block text-slate-500">Room: {c.slotA.room}</span>
                        </div>

                        {/* Slot B details */}
                        <div className="text-[11px] space-y-0.5 border-t sm:border-t-0 sm:border-l sm:pl-4 border-slate-100 pt-2 sm:pt-0">
                          <span className="text-slate-400 font-bold block uppercase text-[9px]">Class Period B</span>
                          <span className="font-extrabold text-slate-800">{c.slotB.subjectName} ({c.slotB.classId})</span>
                          <span className="block text-slate-500">Teacher: {c.slotB.teacherName}</span>
                          <span className="block text-indigo-600 font-bold">Time: {c.slotB.startTime} - {c.slotB.endTime}</span>
                          <span className="block text-slate-500">Room: {c.slotB.room}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

      </div>

      {/* Edit Form Modal Box */}
      <AnimatePresence>
        {isFormOpen && (
          <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-sm flex items-center justify-center p-4 z-50 print:hidden">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white border border-slate-200 rounded-2xl w-full max-w-lg shadow-xl overflow-hidden"
            >
              <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest flex items-center gap-1.5">
                  <Calendar className="w-5 h-5 text-indigo-600" />
                  {isTeacher ? 'Suggest New Period' : (editingSlotId ? 'Edit Scheduled Period' : 'Add Timetable Block')}
                </h3>
                <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  className="p-1 bg-slate-200/60 hover:bg-slate-200 rounded-full text-slate-600 transition-colors"
                >
                  <span className="sr-only">Close</span>
                  ✕
                </button>
              </div>

              <form onSubmit={handleSaveSlot} className="p-6 space-y-4">
                
                {/* Class and Subject */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider">
                      Target Class
                    </label>
                    <select
                      value={formClass}
                      onChange={(e) => setFormClass(e.target.value)}
                      className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-semibold text-slate-800 bg-white"
                      required
                    >
                      <option value="" disabled>Select Class</option>
                      {classesList.map(c => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider">
                      Subject
                    </label>
                    <select
                      value={formSubject}
                      onChange={(e) => setFormSubject(e.target.value)}
                      className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-semibold text-slate-800 bg-white"
                      required
                    >
                      <option value="" disabled>Select Subject</option>
                      {subjectsList.map(s => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Teacher input */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider">
                    Assigned Teacher
                  </label>
                  <select
                    value={formTeacher}
                    onChange={(e) => setFormTeacher(e.target.value)}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-semibold text-slate-800 bg-white"
                    required
                  >
                    <option value="" disabled>Select Teacher</option>
                    {teachersList.map(t => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>

                {/* Day selector */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider">
                      Weekday
                    </label>
                    <select
                      value={formDay}
                      onChange={(e) => setFormDay(e.target.value as any)}
                      className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-semibold text-slate-800 bg-white"
                    >
                      {WEEKDAYS.map(day => (
                        <option key={day} value={day}>{day}</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider">
                      Room / Building Location
                    </label>
                    <input
                      type="text"
                      list="rooms-autocomplete"
                      value={formRoom}
                      onChange={(e) => setFormRoom(e.target.value)}
                      placeholder="e.g. Room A"
                      className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-semibold text-slate-800"
                    />
                    <datalist id="rooms-autocomplete">
                      {roomsList.map(r => <option key={r} value={r} />)}
                    </datalist>
                  </div>
                </div>

                {/* Time picker */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-indigo-500" />
                      Start Time
                    </label>
                    <input
                      type="time"
                      value={formStartTime}
                      onChange={(e) => setFormStartTime(e.target.value)}
                      className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-semibold text-slate-800"
                      required
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-indigo-500" />
                      End Time
                    </label>
                    <input
                      type="time"
                      value={formEndTime}
                      onChange={(e) => setFormEndTime(e.target.value)}
                      className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-semibold text-slate-800"
                      required
                    />
                  </div>
                </div>

                {/* Additional notes */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider">
                    Notes / Lesson Objectives (Optional)
                  </label>
                  <textarea
                    value={formNotes}
                    onChange={(e) => setFormNotes(e.target.value)}
                    placeholder="e.g. Double period for algebra exercises"
                    rows={2}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-semibold text-slate-800"
                  />
                </div>

                <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2 text-xs uppercase font-extrabold tracking-wider">
                  <button
                    type="button"
                    onClick={() => setIsFormOpen(false)}
                    className="px-4 py-2 hover:bg-slate-50 border border-slate-200 rounded-xl text-slate-600 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl transition-all shadow-md shadow-indigo-600/10"
                  >
                    {isTeacher ? 'Submit Suggestion' : (editingSlotId ? 'Update Block' : 'Add Slot')}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
