import React from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/schema';
import { useAuth } from '../contexts/AuthContext';
import { useMemo, useState, useEffect } from 'react';
import { 
  Users, 
  Wallet, 
  CheckCircle2, 
  AlertCircle,
  TrendingUp,
  Edit2,
  ChevronRight,
  BookOpen,
  Printer,
  Megaphone,
  Bell,
  MessageSquare,
  Plus,
  Trash2,
  Send,
  Search,
  Filter,
  Calendar,
  MapPin,
  Clock,
  Check,
  Info,
  Sparkles,
  X,
  BellRing
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer
} from 'recharts';
import { formatCurrency, triggerPrint } from '../lib/utils';

interface DashboardProps {
  onViewChange: (view: 'students' | 'academic' | 'fees' | 'attendance' | 'results') => void;
}

interface Announcement {
  id: string;
  title: string;
  content: string;
  category: 'school announcement' | 'parent notices' | 'PTA notices' | 'PTA notification';
  priority: 'Urgent' | 'Normal';
  author: string;
  createdAt: number;
}

interface UpcomingEvent {
  id: string;
  title: string;
  date: string;
  time: string;
  location: string;
  category: 'Academic' | 'Sports' | 'Holiday' | 'PTA' | 'Social' | 'General';
  description: string;
  color: string;
  createdAt: number;
}

interface InAppNotification {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  read: boolean;
  createdAt: number;
}

export default function Dashboard({ onViewChange }: DashboardProps) {
  const { user } = useAuth();
  const settings = useLiveQuery(() => db.settings.toArray()) || [];
  const schoolName = settings.find(s => s.key === 'schoolProfile')?.value?.schoolName || 'ESEPA INTERNATIONAL SCHOOL';

  const studentCount = useLiveQuery(() => db.students.count());
  const teacherCount = useLiveQuery(() => db.teachers.count());
  const students = useLiveQuery(() => db.students.toArray());
  const results = useLiveQuery(() => db.results.toArray()) || [];
  const recentStudents = useLiveQuery(() => db.students.orderBy('createdAt').reverse().limit(5).toArray());
  const attendanceRecords = useLiveQuery(() => db.attendance.toArray()) || [];
  
  const totalFeesCollected = students?.reduce((acc, s) => acc + (s.feesPaid || 0), 0) || 0;

  const parentWards = useMemo(() => {
    if (user?.role === 'parent' && user?.fullName && students && students.length > 0) {
      const cleanParentName = user.fullName.replace(/\s*\(Parent\)/i, '').trim().toLowerCase();
      return students.filter(s => {
        const guardian = (s.guardianName || '').toLowerCase().trim();
        return guardian.includes(cleanParentName) || cleanParentName.includes(guardian);
      });
    }
    return [];
  }, [user, students]);

  const studentRecord = useMemo(() => {
    if (user?.role === 'student' && user?.fullName && students && students.length > 0) {
      const cleanName = user.fullName.replace(/\s*\(Student\)/i, '').trim().toLowerCase();
      return students.find(s => {
        const full = `${s.firstName} ${s.lastName}`.toLowerCase().trim();
        return full.includes(cleanName) || cleanName.includes(full);
      });
    }
    return null;
  }, [user, students]);

  const [selectedWardId, setSelectedWardId] = useState<string>('');

  useEffect(() => {
    if (parentWards.length > 0 && !selectedWardId) {
      setSelectedWardId(parentWards[0].studentId);
    }
  }, [parentWards, selectedWardId]);

  const selectedWard = useMemo(() => {
    return parentWards.find(w => w.studentId === selectedWardId) || parentWards[0] || null;
  }, [parentWards, selectedWardId]);

  const selectedWardAttendance = useMemo(() => {
    if (!selectedWard?.studentId || !attendanceRecords) return 'N/A';
    const records = attendanceRecords.filter(r => r.studentId === selectedWard.studentId);
    if (records.length === 0) return '100%';
    const presentCount = records.filter(r => r.status === 'Present' || r.status === 'Late').length;
    return `${Math.round((presentCount / records.length) * 100)}%`;
  }, [selectedWard, attendanceRecords]);

  const selectedWardResults = useMemo(() => {
    if (!selectedWard?.studentId || !results) return [];
    return results.filter(r => r.studentId === selectedWard.studentId);
  }, [selectedWard, results]);

  const selectedWardStanding = useMemo(() => {
    if (selectedWardResults.length === 0) return 'High Honors';
    const sum = selectedWardResults.reduce((acc, r) => acc + (r.totalScore || 0), 0);
    const avg = sum / selectedWardResults.length;
    if (avg >= 80) return 'High Honors';
    if (avg >= 70) return 'Honors';
    if (avg >= 60) return 'Satisfactory';
    if (avg >= 50) return 'Needs Improvement';
    return 'Academic Warning';
  }, [selectedWardResults]);

  const selectedWardOutstandingFees = useMemo(() => {
    if (!selectedWard) return 'GHS 0.00';
    const outstanding = Math.max(0, (selectedWard.totalFees || 0) - (selectedWard.feesPaid || 0));
    return formatCurrency(outstanding);
  }, [selectedWard]);

  const studentAttendance = useMemo(() => {
    if (!studentRecord?.studentId || !attendanceRecords) return 'N/A';
    const records = attendanceRecords.filter(r => r.studentId === studentRecord.studentId);
    if (records.length === 0) return '97%';
    const presentCount = records.filter(r => r.status === 'Present' || r.status === 'Late').length;
    return `${Math.round((presentCount / records.length) * 100)}%`;
  }, [studentRecord, attendanceRecords]);

  const studentResults = useMemo(() => {
    if (!studentRecord?.studentId || !results) return [];
    return results.filter(r => r.studentId === studentRecord.studentId);
  }, [studentRecord, results]);

  const studentAverageScore = useMemo(() => {
    if (studentResults.length === 0) return '82.5%';
    const sum = studentResults.reduce((acc, r) => acc + (r.totalScore || 0), 0);
    return `${Math.round(sum / studentResults.length)}%`;
  }, [studentResults]);

  const averageScoreString = useMemo(() => {
    if (!results || results.length === 0) return '74%';
    const sum = results.reduce((acc, r) => acc + (r.totalScore || 0), 0);
    return `${Math.round(sum / results.length)}%`;
  }, [results]);

  const selectedWardChartData = useMemo(() => {
    if (selectedWardResults && selectedWardResults.length > 0) {
      const subjectMap: Record<string, number> = {};
      selectedWardResults.forEach(r => {
        subjectMap[r.subject] = r.totalScore;
      });
      return Object.entries(subjectMap).map(([name, score]) => ({
        name,
        score
      }));
    }
    return [
      { name: 'Mathematics', score: 84 },
      { name: 'English Lang', score: 79 },
      { name: 'Int Science', score: 91 },
      { name: 'Social Studies', score: 82 },
      { name: 'R.M.E.', score: 88 },
    ];
  }, [selectedWardResults]);

  const studentChartData = useMemo(() => {
    if (studentResults && studentResults.length > 0) {
      const subjectMap: Record<string, number> = {};
      studentResults.forEach(r => {
        subjectMap[r.subject] = r.totalScore;
      });
      return Object.entries(subjectMap).map(([name, score]) => ({
        name,
        score
      }));
    }
    return [
      { name: 'Mathematics', score: 84 },
      { name: 'English Lang', score: 79 },
      { name: 'Int Science', score: 91 },
      { name: 'Social Studies', score: 82 },
      { name: 'R.M.E.', score: 88 },
    ];
  }, [studentResults]);

  const stats = useMemo(() => {
    const isTeacher = user?.role === 'teacher';
    const isAccountant = user?.role === 'accountant';
    const isStudent = user?.role === 'student';
    const isParent = user?.role === 'parent';

    if (isTeacher) {
      return [
        { label: 'My Students', value: typeof studentCount === 'number' ? studentCount : 0, icon: Users, color: 'text-blue-600', bg: 'bg-blue-50', view: 'students' as const },
        { label: 'Weekly Attendance', value: '94%', icon: CheckCircle2, color: 'text-emerald-600', bg: 'bg-emerald-50', view: 'attendance' as const },
        { label: 'Average Score', value: averageScoreString, icon: BookOpen, color: 'text-indigo-600', bg: 'bg-indigo-50', view: 'results' as const },
        { label: 'Graded Slates', value: results.length, icon: Edit2, color: 'text-purple-600', bg: 'bg-purple-50', view: 'results' as const }
      ];
    }

    if (isAccountant) {
      const totalBilled = students?.reduce((acc, s) => acc + (s.totalFees || 0), 0) || 0;
      const collectionRate = totalBilled > 0 ? `${Math.round((totalFeesCollected / totalBilled) * 100)}%` : '0%';
      return [
        { label: 'Total Students', value: typeof studentCount === 'number' ? studentCount : 0, icon: Users, color: 'text-blue-600', bg: 'bg-blue-50', view: 'students' as const },
        { label: 'Total Billed', value: formatCurrency(totalBilled), icon: Wallet, color: 'text-indigo-600', bg: 'bg-indigo-50', view: 'fees' as const },
        { label: 'Fees Collected', value: formatCurrency(totalFeesCollected), icon: Wallet, color: 'text-emerald-600', bg: 'bg-emerald-50', view: 'fees' as const },
        { label: 'Collection Rate', value: collectionRate, icon: CheckCircle2, color: 'text-purple-600', bg: 'bg-purple-50', view: 'fees' as const }
      ];
    }

    if (isStudent) {
      return [
        { label: 'My Registered Class', value: studentRecord?.class || 'JHS 3 Gold', icon: Users, color: 'text-blue-600', bg: 'bg-blue-50', view: 'students' as const },
        { label: 'My Attendance Rate', value: studentAttendance, icon: CheckCircle2, color: 'text-emerald-600', bg: 'bg-emerald-50', view: 'attendance' as const },
        { label: 'My Average Score', value: studentAverageScore, icon: BookOpen, color: 'text-indigo-600', bg: 'bg-indigo-50', view: 'results' as const },
        { label: 'Active Term Polls', value: '2 Active', icon: Edit2, color: 'text-purple-600', bg: 'bg-purple-50', view: 'evoting' as const }
      ];
    }

    if (isParent) {
      const wardsCountLabel = parentWards.length === 1 ? '1 Child' : `${parentWards.length} Children`;
      return [
        { label: 'Registered Wards', value: wardsCountLabel, icon: Users, color: 'text-blue-600', bg: 'bg-blue-50', view: 'students' as const },
        { label: 'Ward Attendance', value: selectedWard ? selectedWardAttendance : 'N/A', icon: CheckCircle2, color: 'text-emerald-600', bg: 'bg-emerald-50', view: 'attendance' as const },
        { label: 'Academic Standing', value: selectedWard ? selectedWardStanding : 'N/A', icon: BookOpen, color: 'text-indigo-600', bg: 'bg-indigo-50', view: 'results' as const },
        { label: 'Outstanding Fees', value: selectedWard ? selectedWardOutstandingFees : 'GHS 0.00', icon: Wallet, color: 'text-amber-600', bg: 'bg-amber-50', view: 'fees' as const }
      ];
    }

    // Default Admin / Super Admin / Head Teacher
    return [
      { label: 'Total Students', value: typeof studentCount === 'number' ? studentCount : 0, icon: Users, color: 'text-blue-600', bg: 'bg-blue-50', view: 'students' as const },
      { label: 'Teachers & Staff', value: typeof teacherCount === 'number' ? teacherCount : 0, icon: Users, color: 'text-purple-600', bg: 'bg-purple-50', view: 'academic' as const },
      { label: 'Fees Collected', value: formatCurrency(totalFeesCollected), icon: Wallet, color: 'text-emerald-600', bg: 'bg-emerald-50', view: 'fees' as const },
      { label: 'Attendance Rate', value: '94%', icon: CheckCircle2, color: 'text-indigo-600', bg: 'bg-indigo-50', view: 'attendance' as const },
    ];
  }, [user, studentCount, teacherCount, totalFeesCollected, averageScoreString, results, students, parentWards, selectedWard, selectedWardAttendance, selectedWardStanding, selectedWardOutstandingFees, studentRecord, studentAttendance, studentAverageScore]);

  // --- ANNOUNCEMENT BOARD STATE & SEEDING ---
  const announcementsSetting = useLiveQuery(() => 
    db.settings.where('key').equals('announcements').first()
  );

  const [announcementSearch, setAnnouncementSearch] = useState('');
  const [activeAnnouncementTab, setActiveAnnouncementTab] = useState<'school announcement' | 'parent notices' | 'PTA notices' | 'PTA notification'>('school announcement');
  const [isAddFormOpen, setIsAddFormOpen] = useState(false);
  
  // New announcement form fields
  const [newTitle, setNewTitle] = useState('');
  const [newContent, setNewContent] = useState('');
  const [newCategory, setNewCategory] = useState<'school announcement' | 'parent notices' | 'PTA notices' | 'PTA notification'>('school announcement');
  const [newPriority, setNewPriority] = useState<'Urgent' | 'Normal'>('Normal');
  const [newAuthor, setNewAuthor] = useState('');

  // Set default author name based on logged-in user
  useEffect(() => {
    if (user?.fullName) {
      setNewAuthor(user.fullName);
    }
  }, [user]);

  const announcementsList = useMemo<Announcement[]>(() => {
    if (announcementsSetting?.value) {
      return announcementsSetting.value;
    }
    return [
      {
        id: 'ann-1',
        title: 'Academic Term 2 Calendar Updates',
        content: 'Please note that the upcoming mid-term holidays have been rescheduled to start on Thursday, 12th March, and classes will resume on Monday, 16th March. All terminal examinations will proceed as originally scheduled.',
        category: 'school announcement',
        priority: 'Urgent',
        author: 'Principal Office',
        createdAt: Date.now() - 2 * 24 * 60 * 60 * 1000
      },
      {
        id: 'ann-2',
        title: 'Terminal Report Card Release Schedule',
        content: 'Official end-of-term terminal report cards for all students will be published directly on the Parents and Students Portal this coming Wednesday at 4:00 PM UTC. Please ensure all outstanding fees are settled to enable immediate download access.',
        category: 'parent notices',
        priority: 'Normal',
        author: 'Academic Registrar',
        createdAt: Date.now() - 4 * 24 * 60 * 60 * 1000
      },
      {
        id: 'ann-3',
        title: 'PTA General Assembly & Infrastructure Levy Discussion',
        content: 'All parents and guardians are cordially invited to our Termly PTA general meeting on Saturday, 28th March, at 2:00 PM in the main school assembly hall. Agenda: Sports facility expansion project, computerized school placement, and security levy updates.',
        category: 'PTA notices',
        priority: 'Normal',
        author: 'PTA Executive Committee',
        createdAt: Date.now() - 6 * 24 * 60 * 60 * 1000
      }
    ];
  }, [announcementsSetting]);

  // --- UPCOMING EVENTS STATE & SEEDING ---
  const eventsSetting = useLiveQuery(() => 
    db.settings.where('key').equals('upcomingEvents').first()
  );

  const [isAddEventOpen, setIsAddEventOpen] = useState(false);
  const [eventTitle, setEventTitle] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [eventTime, setEventTime] = useState('');
  const [eventLocation, setEventLocation] = useState('');
  const [eventCategory, setEventCategory] = useState<'Academic' | 'Sports' | 'Holiday' | 'PTA' | 'Social' | 'General'>('General');
  const [eventDescription, setEventDescription] = useState('');

  const eventsList = useMemo<UpcomingEvent[]>(() => {
    if (eventsSetting?.value) {
      return eventsSetting.value;
    }
    return [
      {
        id: 'evt-1',
        title: 'Annual Inter-Houses Athletic Competition',
        date: '2026-07-15',
        time: '08:30 AM',
        location: 'Main Sports Complex Stadium',
        category: 'Sports',
        description: 'Our annual inter-houses athletic meet featuring sprint championships, high-jump trials, and high-stakes football tournament. Parents and alumni are cordially invited!',
        color: 'orange',
        createdAt: Date.now()
      },
      {
        id: 'evt-2',
        title: 'BECE & WASSCE Preparation Orientation',
        date: '2026-07-22',
        time: '10:00 AM',
        location: 'Assembly & Examination Center',
        category: 'Academic',
        description: 'A mandatory registration orientation and career-pathing clinic for JHS 3 and SHS 3 terminal students. Guidance counselors will review examination rules and code of conducts.',
        color: 'indigo',
        createdAt: Date.now()
      },
      {
        id: 'evt-3',
        title: 'Mid-Term PTA General Assembly',
        date: '2026-08-01',
        time: '01:30 PM',
        location: 'Virtual Zoom / Main Auditorium',
        category: 'PTA',
        description: 'Discussion of Term 2 tuition structures, upcoming facility upgrades, and e-learning resources. General assembly voting on security levy.',
        color: 'purple',
        createdAt: Date.now()
      }
    ];
  }, [eventsSetting]);

  // --- NOTIFICATIONS FEED STATE & SEEDING ---
  const notificationsSetting = useLiveQuery(() => 
    db.settings.where('key').equals('notifications').first()
  );

  const [isAddNotifOpen, setIsAddNotifOpen] = useState(false);
  const [notifTitle, setNotifTitle] = useState('');
  const [notifMessage, setNotifMessage] = useState('');
  const [notifType, setNotifType] = useState<'info' | 'success' | 'warning' | 'error'>('info');

  const notificationsList = useMemo<InAppNotification[]>(() => {
    if (notificationsSetting?.value) {
      return notificationsSetting.value;
    }
    return [
      {
        id: 'ntf-1',
        title: 'Term 2 Terminal Exam Report Released',
        message: 'Academic report sheets for JHS level classes are now fully compiled and published. Access is restricted until tuition bills are verified.',
        type: 'info',
        read: false,
        createdAt: Date.now() - 30 * 60 * 1000
      },
      {
        id: 'ntf-2',
        title: 'Tuition Payment Verified (STU-082)',
        message: 'GHS 1,450.00 terminal fee payment via Mobile Money verified. Portal accounting updated successfully.',
        type: 'success',
        read: false,
        createdAt: Date.now() - 3 * 60 * 60 * 1000
      },
      {
        id: 'ntf-3',
        title: 'Server Sync Completed',
        message: 'Your local database was successfully synchronized with the central central server database.',
        type: 'success',
        read: true,
        createdAt: Date.now() - 24 * 60 * 60 * 1000
      }
    ];
  }, [notificationsSetting]);

  // Handle Seeding of default announcements, events, and notifications
  useEffect(() => {
    const seedInitialData = async () => {
      // Announcements
      const existingAnn = await db.settings.where('key').equals('announcements').first();
      if (!existingAnn) {
        await db.settings.add({
          key: 'announcements',
          value: [
            {
              id: 'ann-1',
              title: 'Academic Term 2 Calendar Updates',
              content: 'Please note that the upcoming mid-term holidays have been rescheduled to start on Thursday, 12th March, and classes will resume on Monday, 16th March. All terminal examinations will proceed as originally scheduled.',
              category: 'school announcement',
              priority: 'Urgent',
              author: 'Principal Office',
              createdAt: Date.now() - 2 * 24 * 60 * 60 * 1000
            },
            {
              id: 'ann-2',
              title: 'Terminal Report Card Release Schedule',
              content: 'Official end-of-term terminal report cards for all students will be published directly on the Parents and Students Portal this coming Wednesday at 4:00 PM UTC. Please ensure all outstanding fees are settled to enable immediate download access.',
              category: 'parent notices',
              priority: 'Normal',
              author: 'Academic Registrar',
              createdAt: Date.now() - 4 * 24 * 60 * 60 * 1000
            },
            {
              id: 'ann-3',
              title: 'PTA General Assembly & Infrastructure Levy Discussion',
              content: 'All parents and guardians are cordially invited to our Termly PTA general meeting on Saturday, 28th March, at 2:00 PM in the main school assembly hall. Agenda: Sports facility expansion project, computerized school placement, and security levy updates.',
              category: 'PTA notices',
              priority: 'Normal',
              author: 'PTA Executive Committee',
              createdAt: Date.now() - 6 * 24 * 60 * 60 * 1000
            }
          ]
        });
      }

      // Upcoming Events
      const existingEvt = await db.settings.where('key').equals('upcomingEvents').first();
      if (!existingEvt) {
        await db.settings.add({
          key: 'upcomingEvents',
          value: [
            {
              id: 'evt-1',
              title: 'Annual Inter-Houses Athletic Competition',
              date: '2026-07-15',
              time: '08:30 AM',
              location: 'Main Sports Complex Stadium',
              category: 'Sports',
              description: 'Our annual inter-houses athletic meet featuring sprint championships, high-jump trials, and high-stakes football tournament. Parents and alumni are cordially invited!',
              color: 'orange',
              createdAt: Date.now()
            },
            {
              id: 'evt-2',
              title: 'BECE & WASSCE Preparation Orientation',
              date: '2026-07-22',
              time: '10:00 AM',
              location: 'Assembly & Examination Center',
              category: 'Academic',
              description: 'A mandatory registration orientation and career-pathing clinic for JHS 3 and SHS 3 terminal students. Guidance counselors will review examination rules and code of conducts.',
              color: 'indigo',
              createdAt: Date.now()
            },
            {
              id: 'evt-3',
              title: 'Mid-Term PTA General Assembly',
              date: '2026-08-01',
              time: '01:30 PM',
              location: 'Virtual Zoom / Main Auditorium',
              category: 'PTA',
              description: 'Discussion of Term 2 tuition structures, upcoming facility upgrades, and e-learning resources. General assembly voting on security levy.',
              color: 'purple',
              createdAt: Date.now()
            }
          ]
        });
      }

      // Notifications
      const existingNotif = await db.settings.where('key').equals('notifications').first();
      if (!existingNotif) {
        await db.settings.add({
          key: 'notifications',
          value: [
            {
              id: 'ntf-1',
              title: 'Term 2 Terminal Exam Report Released',
              message: 'Academic report sheets for JHS level classes are now fully compiled and published. Access is restricted until tuition bills are verified.',
              type: 'info',
              read: false,
              createdAt: Date.now() - 30 * 60 * 1000
            },
            {
              id: 'ntf-2',
              title: 'Tuition Payment Verified (STU-082)',
              message: 'GHS 1,450.00 terminal fee payment via Mobile Money verified. Portal accounting updated successfully.',
              type: 'success',
              read: false,
              createdAt: Date.now() - 3 * 60 * 60 * 1000
            },
            {
              id: 'ntf-3',
              title: 'Server Sync Completed',
              message: 'Your local database was successfully synchronized with the central central server database.',
              type: 'success',
              read: true,
              createdAt: Date.now() - 24 * 60 * 60 * 1000
            }
          ]
        });
      }
    };
    seedInitialData();
  }, []);

  const handleAddAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newContent.trim()) return;

    const newAnn: Announcement = {
      id: `ann-${Date.now()}`,
      title: newTitle.trim(),
      content: newContent.trim(),
      category: newCategory,
      priority: newPriority,
      author: newAuthor.trim() || user?.fullName || 'School Admin',
      createdAt: Date.now()
    };

    const existing = await db.settings.where('key').equals('announcements').first();
    const updatedValue = existing ? [newAnn, ...existing.value] : [newAnn];
    
    if (existing) {
      await db.settings.update(existing.id!, { value: updatedValue });
    } else {
      await db.settings.add({ key: 'announcements', value: updatedValue });
    }

    // Reset Form fields
    setNewTitle('');
    setNewContent('');
    setNewCategory('school announcement');
    setNewPriority('Normal');
    setIsAddFormOpen(false);
  };

  const handleDeleteAnnouncement = async (id: string) => {
    const existing = await db.settings.where('key').equals('announcements').first();
    if (existing) {
      const updatedValue = existing.value.filter((ann: Announcement) => ann.id !== id);
      await db.settings.update(existing.id!, { value: updatedValue });
    }
  };

  // --- EVENTS HANDLERS ---
  const handleAddEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!eventTitle.trim() || !eventDate || !eventTime) return;

    const colors: Record<string, string> = {
      Academic: 'indigo',
      Sports: 'orange',
      Holiday: 'amber',
      PTA: 'purple',
      Social: 'pink',
      General: 'slate'
    };
    const color = colors[eventCategory] || 'slate';

    const newEvent: UpcomingEvent = {
      id: `evt-${Date.now()}`,
      title: eventTitle.trim(),
      date: eventDate,
      time: eventTime,
      location: eventLocation.trim() || 'School Grounds',
      category: eventCategory,
      description: eventDescription.trim() || 'No additional description provided.',
      color,
      createdAt: Date.now()
    };

    const existing = await db.settings.where('key').equals('upcomingEvents').first();
    const updatedValue = existing ? [...existing.value, newEvent] : [newEvent];

    // Sort by date ascending
    updatedValue.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    if (existing) {
      await db.settings.update(existing.id!, { value: updatedValue });
    } else {
      await db.settings.add({ key: 'upcomingEvents', value: updatedValue });
    }

    setEventTitle('');
    setEventDate('');
    setEventTime('');
    setEventLocation('');
    setEventCategory('General');
    setEventDescription('');
    setIsAddEventOpen(false);
  };

  const handleDeleteEvent = async (id: string) => {
    const existing = await db.settings.where('key').equals('upcomingEvents').first();
    if (existing) {
      const updatedValue = existing.value.filter((evt: UpcomingEvent) => evt.id !== id);
      await db.settings.update(existing.id!, { value: updatedValue });
    }
  };

  // --- NOTIFICATION HANDLERS ---
  const handleAddNotification = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!notifTitle.trim() || !notifMessage.trim()) return;

    const newNotif: InAppNotification = {
      id: `ntf-${Date.now()}`,
      title: notifTitle.trim(),
      message: notifMessage.trim(),
      type: notifType,
      read: false,
      createdAt: Date.now()
    };

    const existing = await db.settings.where('key').equals('notifications').first();
    const updatedValue = existing ? [newNotif, ...existing.value] : [newNotif];

    if (existing) {
      await db.settings.update(existing.id!, { value: updatedValue });
    } else {
      await db.settings.add({ key: 'notifications', value: updatedValue });
    }

    setNotifTitle('');
    setNotifMessage('');
    setNotifType('info');
    setIsAddNotifOpen(false);
  };

  const handleToggleNotificationRead = async (id: string) => {
    const existing = await db.settings.where('key').equals('notifications').first();
    if (existing) {
      const updatedValue = existing.value.map((n: InAppNotification) => 
        n.id === id ? { ...n, read: !n.read } : n
      );
      await db.settings.update(existing.id!, { value: updatedValue });
    }
  };

  const handleMarkAllNotificationsRead = async () => {
    const existing = await db.settings.where('key').equals('notifications').first();
    if (existing) {
      const updatedValue = existing.value.map((n: InAppNotification) => ({ ...n, read: true }));
      await db.settings.update(existing.id!, { value: updatedValue });
    }
  };

  const handleDeleteNotification = async (id: string) => {
    const existing = await db.settings.where('key').equals('notifications').first();
    if (existing) {
      const updatedValue = existing.value.filter((n: InAppNotification) => n.id !== id);
      await db.settings.update(existing.id!, { value: updatedValue });
    }
  };

  const handleClearAllNotifications = async () => {
    const existing = await db.settings.where('key').equals('notifications').first();
    if (existing) {
      await db.settings.update(existing.id!, { value: [] });
    }
  };

  const filteredAnnouncements = useMemo(() => {
    return announcementsList.filter(ann => {
      const matchesTab = ann.category === activeAnnouncementTab;
      const matchesSearch = ann.title.toLowerCase().includes(announcementSearch.toLowerCase()) ||
                            ann.content.toLowerCase().includes(announcementSearch.toLowerCase()) ||
                            ann.author.toLowerCase().includes(announcementSearch.toLowerCase());
      return matchesTab && matchesSearch;
    });
  }, [announcementsList, activeAnnouncementTab, announcementSearch]);

  const categoryCounts = useMemo(() => {
    const counts = { All: announcementsList.length, school: 0, parent: 0, ptaNotices: 0, ptaNotification: 0 };
    announcementsList.forEach(ann => {
      if (ann.category === 'school announcement') counts.school++;
      if (ann.category === 'parent notices') counts.parent++;
      if (ann.category === 'PTA notices') counts.ptaNotices++;
      if (ann.category === 'PTA notification') counts.ptaNotification++;
    });
    return counts;
  }, [announcementsList]);

  const isStaff = user?.role === 'super_admin' || user?.role === 'admin' || user?.role === 'headteacher' || user?.role === 'teacher';

  return (
    <div className="space-y-4 sm:space-y-8">
      {/* Print Only Header */}
      <div className="only-print">
        <h1 className="text-3xl font-black text-slate-900 uppercase tracking-tighter text-center">{schoolName}</h1>
        <div className="mt-2 text-sm font-bold text-slate-600 uppercase tracking-widest flex items-center justify-center gap-4">
          <span>Administrative Dashboard Summary</span>
          <span className="w-1.5 h-1.5 bg-slate-400 rounded-full" />
          <span>{new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })}</span>
        </div>
      </div>

      <div className="flex items-center justify-between print:hidden">
        <div className="flex items-center gap-3">
          <h2 className="text-2xl font-black text-slate-900 tracking-tight">Overview</h2>
        </div>
        <button 
          onClick={triggerPrint}
          className="flex items-center gap-2 px-5 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-700 font-bold hover:bg-slate-50 hover:border-slate-300 transition-all shadow-sm active:scale-95 h-11"
        >
          <Printer className="w-4 h-4 text-indigo-600" />
          <span>Print Summary</span>
        </button>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        {stats.map((stat, i) => (
          <button 
            key={i} 
            onClick={() => {
              if (stat.view) {
                onViewChange(stat.view);
              }
            }}
            className="bg-white p-4 sm:p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-all text-left group"
          >
            <div className="flex items-center justify-between mb-4">
              <div className={`${stat.bg} p-2.5 sm:p-3 rounded-xl group-hover:scale-110 transition-transform`}>
                <stat.icon className={`w-5 h-5 sm:w-6 sm:h-6 ${stat.color}`} />
              </div>
              <span className="text-emerald-500 text-[10px] sm:text-xs font-bold flex items-center gap-1">
                <TrendingUp className="w-3 h-3" /> +2.4%
              </span>
            </div>
            <p className="text-slate-500 text-xs sm:text-sm font-medium">{stat.label}</p>
            <h3 className="text-xl sm:text-2xl font-bold text-slate-900 mt-1">{stat.value}</h3>
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 sm:gap-8">
        {/* Main Analytics Chart */}
        <div className={`bg-white p-4 sm:p-8 rounded-2xl border border-slate-200 shadow-sm overflow-hidden ${
          (user?.role === 'student' || user?.role === 'parent') ? 'lg:col-span-3' : 'lg:col-span-2'
        }`}>
          {user?.role === 'teacher' || user?.role === 'student' || user?.role === 'parent' ? (
            // Teacher, Student, or Parent specific: Classroom scores or ward performance
            <>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
                <div className="space-y-1">
                  <h3 className="text-lg font-bold text-slate-900">
                    {user?.role === 'student' ? 'My Academic Performance' : user?.role === 'parent' ? `${selectedWard ? selectedWard.firstName : "Ward"}'s Performance Trend` : 'Academic Score Averages'}
                  </h3>
                  {user?.role === 'parent' && parentWards.length > 1 && (
                    <div className="flex flex-wrap gap-2 mt-2">
                      {parentWards.map(ward => (
                        <button
                          key={ward.id || ward.studentId}
                          onClick={() => setSelectedWardId(ward.studentId)}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border ${
                            selectedWardId === ward.studentId
                              ? 'bg-indigo-600 border-indigo-600 text-white shadow-sm shadow-indigo-600/10'
                              : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-600'
                          }`}
                        >
                          👤 {ward.firstName} {ward.lastName}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <span className="text-slate-400 text-xs font-bold">Performance Breakdown</span>
              </div>
              <div className="h-[250px] sm:h-[300px] w-full relative">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={
                    user?.role === 'student' ? studentChartData :
                    user?.role === 'parent' ? selectedWardChartData :
                    [
                      { name: 'Mathematics', score: 84 },
                      { name: 'English Lang', score: 79 },
                      { name: 'Int Science', score: 91 },
                      { name: 'Social Studies', score: 82 },
                      { name: 'R.M.E.', score: 88 },
                    ]
                  }>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis 
                      dataKey="name" 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{fill: '#64748b', fontSize: 10}} 
                      dy={10} 
                    />
                    <YAxis 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{fill: '#64748b', fontSize: 10}} 
                      width={30}
                      domain={[0, 100]}
                    />
                    <Tooltip 
                      cursor={{fill: '#f8fafc'}}
                      contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', fontSize: '12px'}}
                    />
                    <Bar dataKey="score" fill="var(--color-indigo-600)" radius={[4, 4, 0, 0]} barSize={32} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </>
          ) : (
            // Accountant & Admin layout: Revenue overview
            <>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
                <h3 className="text-lg font-bold text-slate-900">Revenue Overview</h3>
                <div className="flex items-center gap-2">
                  <select className="bg-slate-50 border border-slate-200 text-sm rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500">
                    <option>This Term</option>
                    <option>Last Term</option>
                  </select>
                  {(user?.role as string) !== 'teacher' && (
                    <button 
                      onClick={() => onViewChange('fees')}
                      className="text-indigo-600 text-xs font-bold hover:underline whitespace-nowrap"
                    >
                      View Fees
                    </button>
                  )}
                </div>
              </div>
              <div className="h-[250px] sm:h-[300px] w-full relative">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={[
                    { month: 'Jan', amount: 4500 },
                    { month: 'Feb', amount: 5200 },
                    { month: 'Mar', amount: 4800 },
                    { month: 'Apr', amount: 6100 },
                    { month: 'May', amount: 5500 },
                  ]}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis 
                      dataKey="month" 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{fill: '#64748b', fontSize: 10}} 
                      dy={10} 
                    />
                    <YAxis 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{fill: '#64748b', fontSize: 10}} 
                      width={30}
                    />
                    <Tooltip 
                      cursor={{fill: '#f8fafc'}}
                      contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', fontSize: '12px'}}
                    />
                    <Bar dataKey="amount" fill="var(--color-indigo-600)" radius={[4, 4, 0, 0]} barSize={32} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </>
          )}
        </div>

        {/* Quick Actions & Recent */}
        {(user?.role as string) !== 'student' && (user?.role as string) !== 'parent' && (
          <div className="space-y-6 sm:space-y-8">
            <div className="bg-white p-6 sm:p-8 rounded-2xl border border-slate-200 shadow-sm">
              <h3 className="text-lg font-bold text-slate-900 mb-6">Quick Actions</h3>
              <div className="space-y-3 sm:space-y-4">
                <button 
                  onClick={() => onViewChange('students')}
                  className="w-full flex items-center justify-between p-3 sm:p-4 rounded-xl border border-slate-100 hover:border-indigo-200 hover:bg-slate-50 transition-all group text-left"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center shrink-0">
                      <Users className="w-4 h-4 text-indigo-600" />
                    </div>
                    <span className="text-sm font-semibold text-slate-700">
                      {user?.role === 'admin' || user?.role === 'super_admin' ? 'Manage Students' : 'View Students'}
                    </span>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-indigo-600 transition-colors shrink-0" />
                </button>

                {(user?.role as string) !== 'teacher' && (user?.role as string) !== 'student' && (user?.role as string) !== 'parent' && (
                  <button 
                    onClick={() => onViewChange('fees')}
                    className="w-full flex items-center justify-between p-3 sm:p-4 rounded-xl border border-slate-100 hover:border-indigo-200 hover:bg-slate-50 transition-all group text-left"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center shrink-0">
                        <Wallet className="w-4 h-4 text-emerald-600" />
                      </div>
                      <span className="text-sm font-semibold text-slate-700">Record Fee Payment</span>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-indigo-600 transition-colors shrink-0" />
                  </button>
                )}

                {(user?.role as string) !== 'accountant' && (user?.role as string) !== 'student' && (user?.role as string) !== 'parent' && (
                  <button 
                    onClick={() => onViewChange('results')}
                    className="w-full flex items-center justify-between p-3 sm:p-4 rounded-xl border border-slate-100 hover:border-indigo-200 hover:bg-slate-50 transition-all group text-left"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center shrink-0">
                        <BookOpen className="w-4 h-4 text-indigo-600" />
                      </div>
                      <span className="text-sm font-semibold text-slate-700">Enter Exam Results</span>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-indigo-600 transition-colors shrink-0" />
                  </button>
                )}
              </div>
            </div>

            <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-slate-900">Recent Students</h3>
                <button onClick={() => onViewChange('students')} className="text-indigo-600 text-xs font-bold hover:underline">View All</button>
              </div>
              <div className="space-y-4">
                {recentStudents?.map(student => (
                  <div key={student.id} className="flex items-center justify-between">
                    <div className="flex items-center gap-3 truncate mr-2">
                      <div className="w-10 h-10 rounded-full bg-slate-100 flex-shrink-0 overflow-hidden border border-slate-200">
                        {student.photo ? (
                          <img src={student.photo} alt={student.firstName} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-indigo-50 text-indigo-600 font-bold text-sm uppercase">
                            {student.firstName?.[0] || 'S'}
                          </div>
                        )}
                      </div>
                      <div className="truncate">
                        <p className="text-sm font-bold text-slate-900 truncate">{student.firstName} {student.lastName}</p>
                        <p className="text-xs text-slate-400 truncate">{student.class}</p>
                      </div>
                    </div>
                    <button 
                      onClick={() => onViewChange('students')}
                      className="p-2 hover:bg-slate-50 rounded-lg text-slate-400 hover:text-indigo-600 transition-all shrink-0"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* --- UPCOMING EVENTS & NOTIFICATIONS SECTION --- */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8 mt-8">
        {/* --- COLUMN 1: UPCOMING EVENTS --- */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
          <div className="p-5 sm:p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/40">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-orange-50 flex items-center justify-center text-orange-600">
                <Calendar className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm sm:text-base font-black text-slate-900 uppercase tracking-tight">Upcoming School Events</h3>
                <p className="text-[10px] text-slate-500 font-semibold">Scheduled academic and extracurricular events</p>
              </div>
            </div>
            {isStaff && (
              <button
                onClick={() => setIsAddEventOpen(!isAddEventOpen)}
                className="p-2 hover:bg-slate-100 rounded-lg text-slate-500 hover:text-indigo-600 transition-all cursor-pointer border border-slate-200"
                title="Schedule Event"
              >
                {isAddEventOpen ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
              </button>
            )}
          </div>

          {/* Inline Add Event Form */}
          {isStaff && isAddEventOpen && (
            <div className="p-5 border-b border-slate-100 bg-orange-50/20">
              <form onSubmit={handleAddEvent} className="space-y-3.5">
                <h4 className="text-[10px] font-black uppercase tracking-wider text-orange-950 flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5 text-orange-500 animate-pulse" />
                  <span>Create Upcoming School Event</span>
                </h4>
                
                <div className="space-y-1">
                  <label className="text-[9px] font-black uppercase tracking-wider text-slate-400 block">Event Title</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Inter-Houses Swimming Gala"
                    value={eventTitle}
                    onChange={(e) => setEventTitle(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500 transition-all text-slate-800"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[9px] font-black uppercase tracking-wider text-slate-400 block">Event Date</label>
                    <input
                      type="date"
                      required
                      value={eventDate}
                      onChange={(e) => setEventDate(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500 transition-all text-slate-800"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-black uppercase tracking-wider text-slate-400 block">Event Time</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. 10:00 AM"
                      value={eventTime}
                      onChange={(e) => setEventTime(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500 transition-all text-slate-800"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[9px] font-black uppercase tracking-wider text-slate-400 block">Location</label>
                    <input
                      type="text"
                      placeholder="e.g. Assembly Hall"
                      value={eventLocation}
                      onChange={(e) => setEventLocation(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500 transition-all text-slate-800"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-black uppercase tracking-wider text-slate-400 block">Category</label>
                    <select
                      value={eventCategory}
                      onChange={(e) => setEventCategory(e.target.value as any)}
                      className="w-full px-2 py-2 bg-white border border-slate-200 rounded-lg text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500 transition-all text-slate-800"
                    >
                      <option value="General">General</option>
                      <option value="Academic">Academic</option>
                      <option value="Sports">Sports</option>
                      <option value="Holiday">Holiday</option>
                      <option value="PTA">PTA</option>
                      <option value="Social">Social</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[9px] font-black uppercase tracking-wider text-slate-400 block">Event Description</label>
                  <textarea
                    rows={2}
                    placeholder="Provide event overview, guidelines, or details..."
                    value={eventDescription}
                    onChange={(e) => setEventDescription(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500 transition-all text-slate-800"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg font-bold text-xs uppercase tracking-wider shadow-sm cursor-pointer transition-all active:scale-[0.98]"
                >
                  Publish School Event
                </button>
              </form>
            </div>
          )}

          {/* Events List */}
          <div className="p-5 sm:p-6 space-y-4 max-h-[420px] overflow-y-auto flex-1">
            {eventsList.length > 0 ? (
              eventsList.map((evt) => (
                <div
                  key={evt.id}
                  className="p-4 rounded-xl border border-slate-100 hover:border-slate-200 bg-slate-50/30 transition-all flex items-start gap-4"
                >
                  {/* Left Date Block */}
                  <div className="flex-shrink-0 w-14 py-2 px-1.5 rounded-lg bg-indigo-50 border border-indigo-100/50 flex flex-col items-center justify-center text-center">
                    <span className="text-[10px] font-black uppercase tracking-wider text-indigo-400">
                      {new Date(evt.date).toLocaleDateString('en-US', { month: 'short' })}
                    </span>
                    <span className="text-lg font-black text-indigo-700 leading-none mt-0.5">
                      {new Date(evt.date).toLocaleDateString('en-US', { day: '2-digit' })}
                    </span>
                  </div>

                  {/* Context Block */}
                  <div className="flex-1 space-y-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className={`px-2 py-0.5 rounded-md text-[8px] font-black uppercase tracking-wider ${
                        evt.category === 'Academic' ? 'bg-indigo-50 text-indigo-600 border border-indigo-100/30' :
                        evt.category === 'Sports' ? 'bg-orange-50 text-orange-600 border border-orange-100/30' :
                        evt.category === 'Holiday' ? 'bg-amber-50 text-amber-600 border border-amber-100/30' :
                        evt.category === 'PTA' ? 'bg-purple-50 text-purple-600 border border-purple-100/30' :
                        evt.category === 'Social' ? 'bg-pink-50 text-pink-600 border border-pink-100/30' :
                        'bg-slate-50 text-slate-600 border border-slate-100/30'
                      }`}>
                        {evt.category}
                      </span>
                      <span className="text-[9px] text-slate-400 font-mono flex items-center gap-0.5">
                        <Clock className="w-2.5 h-2.5" />
                        {evt.time}
                      </span>
                    </div>

                    <h4 className="text-xs sm:text-sm font-extrabold text-slate-800 leading-snug uppercase tracking-tight">
                      {evt.title}
                    </h4>

                    <p className="text-[11px] text-slate-500 font-medium leading-relaxed">
                      {evt.description}
                    </p>

                    <div className="text-[9px] text-slate-400 font-bold flex items-center gap-1 pt-1">
                      <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                      <span className="truncate uppercase">{evt.location}</span>
                    </div>
                  </div>

                  {isStaff && (
                    <button
                      onClick={() => handleDeleteEvent(evt.id)}
                      className="p-1.5 hover:bg-rose-50 rounded text-slate-400 hover:text-rose-600 transition-all shrink-0 cursor-pointer"
                      title="Delete Event"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ))
            ) : (
              <div className="py-16 text-center border-2 border-dashed border-slate-100 rounded-xl">
                <Calendar className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <p className="text-xs font-bold text-slate-500">No scheduled school events</p>
                <p className="text-[10px] text-slate-400 mt-0.5">Check back later or add new events</p>
              </div>
            )}
          </div>
        </div>

        {/* --- COLUMN 2: LIVE NOTIFICATIONS --- */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
          <div className="p-5 sm:p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/40">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600 relative">
                <BellRing className="w-4 h-4" />
                {notificationsList.some(n => !n.read) && (
                  <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-blue-600 rounded-full animate-ping" />
                )}
              </div>
              <div>
                <h3 className="text-sm sm:text-base font-black text-slate-900 uppercase tracking-tight flex items-center gap-1.5">
                  <span>Live System Alerts</span>
                  {notificationsList.filter(n => !n.read).length > 0 && (
                    <span className="px-1.5 py-0.5 bg-blue-100 text-blue-700 text-[9px] font-black rounded-md uppercase tracking-wider">
                      {notificationsList.filter(n => !n.read).length} New
                    </span>
                  )}
                </h3>
                <p className="text-[10px] text-slate-500 font-semibold">Real-time alerts, payment confirmations, and system notices</p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={handleMarkAllNotificationsRead}
                className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-500 hover:text-emerald-600 transition-all cursor-pointer"
                title="Mark all as read"
              >
                <Check className="w-4 h-4" />
              </button>
              <button
                onClick={handleClearAllNotifications}
                className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-500 hover:text-rose-600 transition-all cursor-pointer"
                title="Clear all"
              >
                <Trash2 className="w-4 h-4" />
              </button>
              {isStaff && (
                <button
                  onClick={() => setIsAddNotifOpen(!isAddNotifOpen)}
                  className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-500 hover:text-indigo-600 transition-all cursor-pointer ml-1 border border-slate-200"
                  title="Publish Alert"
                >
                  {isAddNotifOpen ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                </button>
              )}
            </div>
          </div>

          {/* Inline Add Notification Form */}
          {isStaff && isAddNotifOpen && (
            <div className="p-5 border-b border-slate-100 bg-blue-50/20">
              <form onSubmit={handleAddNotification} className="space-y-3.5">
                <h4 className="text-[10px] font-black uppercase tracking-wider text-blue-950 flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5 text-blue-500 animate-pulse" />
                  <span>Publish In-App Notification Alert</span>
                </h4>

                <div className="space-y-1">
                  <label className="text-[9px] font-black uppercase tracking-wider text-slate-400 block">Alert Title</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Fees Invoice Updated"
                    value={notifTitle}
                    onChange={(e) => setNotifTitle(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500 transition-all text-slate-800"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1 col-span-2">
                    <label className="text-[9px] font-black uppercase tracking-wider text-slate-400 block">Severity Level</label>
                    <div className="grid grid-cols-4 gap-2">
                      {(['info', 'success', 'warning', 'error'] as const).map((t) => (
                        <button
                          key={t}
                          type="button"
                          onClick={() => setNotifType(t)}
                          className={`py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider border transition-all ${
                            notifType === t
                              ? t === 'success' ? 'bg-emerald-600 border-emerald-600 text-white' :
                                t === 'warning' ? 'bg-amber-500 border-amber-500 text-white' :
                                t === 'error' ? 'bg-rose-600 border-rose-600 text-white' :
                                'bg-indigo-600 border-indigo-600 text-white'
                              : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-600'
                          }`}
                        >
                          {t}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[9px] font-black uppercase tracking-wider text-slate-400 block">Alert Message</label>
                  <textarea
                    rows={2}
                    required
                    placeholder="Enter short alert context details..."
                    value={notifMessage}
                    onChange={(e) => setNotifMessage(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500 transition-all text-slate-800"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold text-xs uppercase tracking-wider shadow-sm cursor-pointer transition-all active:scale-[0.98]"
                >
                  Send System Notification
                </button>
              </form>
            </div>
          )}

          {/* Notifications Feed */}
          <div className="p-5 sm:p-6 space-y-3.5 max-h-[420px] overflow-y-auto flex-1">
            {notificationsList.length > 0 ? (
              notificationsList.map((notif) => (
                <div
                  key={notif.id}
                  onClick={() => handleToggleNotificationRead(notif.id)}
                  className={`p-3.5 rounded-xl border transition-all relative flex items-start gap-3.5 cursor-pointer ${
                    notif.read ? 'bg-white border-slate-100 opacity-70' : 'bg-slate-50 border-slate-200 shadow-sm'
                  } border-l-4 ${
                    notif.type === 'success' ? 'border-l-emerald-500' :
                    notif.type === 'warning' ? 'border-l-amber-500' :
                    notif.type === 'error' ? 'border-l-rose-500' :
                    'border-l-indigo-500'
                  }`}
                >
                  {/* Type Icon Badge */}
                  <div className={`w-8 h-8 rounded-lg shrink-0 flex items-center justify-center ${
                    notif.type === 'success' ? 'bg-emerald-50 text-emerald-600' :
                    notif.type === 'warning' ? 'bg-amber-50 text-amber-500' :
                    notif.type === 'error' ? 'bg-rose-50 text-rose-600' :
                    'bg-indigo-50 text-indigo-600'
                  }`}>
                    {notif.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> :
                     notif.type === 'warning' ? <AlertCircle className="w-4 h-4" /> :
                     notif.type === 'error' ? <AlertCircle className="w-4 h-4" /> :
                     <Info className="w-4 h-4" />}
                  </div>

                  {/* Body Context */}
                  <div className="flex-1 min-w-0 space-y-0.5">
                    <div className="flex items-center justify-between gap-2">
                      <h4 className="text-xs font-extrabold text-slate-800 truncate uppercase tracking-tight">
                        {notif.title}
                      </h4>
                      <span className="text-[9px] font-mono text-slate-400 whitespace-nowrap">
                        {Math.abs(Date.now() - notif.createdAt) < 60000 ? 'Just now' :
                         Math.abs(Date.now() - notif.createdAt) < 3600000 ? `${Math.floor(Math.abs(Date.now() - notif.createdAt) / 60000)}m ago` :
                         Math.abs(Date.now() - notif.createdAt) < 86400000 ? `${Math.floor(Math.abs(Date.now() - notif.createdAt) / 3600000)}h ago` :
                         new Date(notif.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
                      </span>
                    </div>

                    <p className="text-[11px] text-slate-500 font-medium leading-relaxed">
                      {notif.message}
                    </p>
                  </div>

                  {/* Right Actions */}
                  <div className="flex items-center gap-1.5 shrink-0 self-center">
                    {!notif.read && (
                      <span className="w-2.5 h-2.5 bg-blue-600 rounded-full shrink-0 animate-pulse" />
                    )}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteNotification(notif.id);
                      }}
                      className="p-1 hover:bg-rose-50 rounded text-slate-300 hover:text-rose-600 transition-all cursor-pointer"
                      title="Dismiss notification"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <div className="py-16 text-center border-2 border-dashed border-slate-100 rounded-xl">
                <Bell className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <p className="text-xs font-bold text-slate-500">Your notifications feed is empty</p>
                <p className="text-[10px] text-slate-400 mt-0.5">There are no system notifications at this time.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* --- ANNOUNCEMENT BOARD / BULLETIN CENTER --- */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden mt-8">
        <div className="p-6 sm:p-8 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600">
              <Megaphone className="w-5 h-5 animate-bounce" />
            </div>
            <div>
              <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight">Esepa Bulletin & Notice Board</h3>
              <p className="text-xs text-slate-500 font-semibold mt-0.5">Official community guidelines, parent circulars, and PTA notifications</p>
            </div>
          </div>
          
          {isStaff && (
            <button
              onClick={() => setIsAddFormOpen(!isAddFormOpen)}
              className="flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold transition-all text-xs uppercase tracking-wider shadow-sm shadow-indigo-100 self-start sm:self-auto"
            >
              <Plus className="w-4 h-4" />
              <span>{isAddFormOpen ? 'Close Composer' : 'Publish New Circular'}</span>
            </button>
          )}
        </div>

        {/* Dynamic Composer Panel */}
        {isStaff && isAddFormOpen && (
          <div className="p-6 border-b border-slate-200 bg-indigo-50/30">
            <form onSubmit={handleAddAnnouncement} className="space-y-4 max-w-3xl">
              <h4 className="text-xs font-black uppercase tracking-wider text-indigo-950 flex items-center gap-1.5 mb-2">
                <Bell className="w-4 h-4 text-indigo-600" />
                <span>Compose New Official Circular Notice</span>
              </h4>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">Notice Title</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g., Terminal Examination Schedule Changes"
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500 transition-all text-slate-800"
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">Category Group</label>
                    <select
                      value={newCategory}
                      onChange={(e) => setNewCategory(e.target.value as any)}
                      className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500 transition-all text-slate-800"
                    >
                      <option value="school announcement">school announcement</option>
                      <option value="parent notices">parent notices</option>
                      <option value="PTA notices">PTA notices</option>
                      <option value="PTA notification">PTA notification</option>
                    </select>
                  </div>
                  
                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">Urgency</label>
                    <select
                      value={newPriority}
                      onChange={(e) => setNewPriority(e.target.value as any)}
                      className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500 transition-all text-slate-800"
                    >
                      <option value="Normal">Standard</option>
                      <option value="Urgent">Urgent</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">Notice Description / Message</label>
                <textarea
                  required
                  rows={3}
                  placeholder="Draft the complete context or detailed instructions of the notice here..."
                  value={newContent}
                  onChange={(e) => setNewContent(e.target.value)}
                  className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500 transition-all text-slate-800"
                />
              </div>

              <div className="flex items-center justify-between pt-2">
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">Publishing Signature / Author</label>
                  <input
                    type="text"
                    placeholder="e.g. Principal's Office"
                    value={newAuthor}
                    onChange={(e) => setNewAuthor(e.target.value)}
                    className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500 transition-all text-slate-800"
                  />
                </div>

                <button
                  type="submit"
                  className="flex items-center gap-2 px-5 py-2.5 bg-slate-900 hover:bg-slate-950 text-white rounded-xl font-bold transition-all text-xs uppercase tracking-wider shadow-sm active:scale-95 cursor-pointer"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Send Broadcast</span>
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Search, Filter, Tabs Row */}
        <div className="p-4 sm:p-6 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-50/20">
          {/* Quick Filters */}
          <div className="flex flex-wrap gap-1.5">
            <button
              onClick={() => setActiveAnnouncementTab('school announcement')}
              className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all border ${
                activeAnnouncementTab === 'school announcement'
                  ? 'bg-indigo-600 border-indigo-600 text-white shadow-sm'
                  : 'bg-white hover:bg-indigo-50 border-slate-200 text-indigo-600'
              }`}
            >
              🏫 school announcement ({categoryCounts.school})
            </button>
            <button
              onClick={() => setActiveAnnouncementTab('parent notices')}
              className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all border ${
                activeAnnouncementTab === 'parent notices'
                  ? 'bg-emerald-600 border-emerald-600 text-white shadow-sm'
                  : 'bg-white hover:bg-emerald-50 border-slate-200 text-emerald-600'
              }`}
            >
              🛡️ parent notices ({categoryCounts.parent})
            </button>
            <button
              onClick={() => setActiveAnnouncementTab('PTA notices')}
              className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all border ${
                activeAnnouncementTab === 'PTA notices'
                  ? 'bg-purple-600 border-purple-600 text-white shadow-sm'
                  : 'bg-white hover:bg-purple-50 border-slate-200 text-purple-600'
              }`}
            >
              👥 PTA notices ({categoryCounts.ptaNotices})
            </button>
            <button
              onClick={() => setActiveAnnouncementTab('PTA notification')}
              className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all border ${
                activeAnnouncementTab === 'PTA notification'
                  ? 'bg-pink-600 border-pink-600 text-white shadow-sm'
                  : 'bg-white hover:bg-pink-50 border-slate-200 text-pink-600'
              }`}
            >
              📢 PTA notification ({categoryCounts.ptaNotification})
            </button>
          </div>

          {/* Quick Search */}
          <div className="relative w-full md:max-w-xs">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search circular bulletins..."
              value={announcementSearch}
              onChange={(e) => setAnnouncementSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500 transition-all text-slate-700"
            />
          </div>
        </div>

        {/* Notices Stack */}
        <div className="p-6 sm:p-8 space-y-4">
          {filteredAnnouncements.length > 0 ? (
            filteredAnnouncements.map((ann) => (
              <div
                key={ann.id}
                className={`p-5 rounded-2xl border transition-all hover:shadow-md relative flex flex-col md:flex-row md:items-start justify-between gap-4 border-l-4 ${
                  ann.priority === 'Urgent' ? 'bg-rose-50/20 hover:bg-rose-50/40 border-slate-200' : 'bg-slate-50/30 hover:bg-slate-50/60 border-slate-200'
                } ${
                  ann.category === 'school announcement' ? 'border-l-indigo-500' :
                  ann.category === 'parent notices' ? 'border-l-emerald-500' :
                  ann.category === 'PTA notices' ? 'border-l-purple-500' : 'border-l-pink-500'
                }`}
              >
                <div className="space-y-2.5 flex-1 max-w-4xl">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`px-2.5 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider border ${
                      ann.category === 'school announcement' ? 'bg-indigo-50 text-indigo-600 border-indigo-100' :
                      ann.category === 'parent notices' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' :
                      ann.category === 'PTA notices' ? 'bg-purple-50 text-purple-600 border-purple-100' :
                      'bg-pink-50 text-pink-600 border-pink-100'
                    }`}>
                      {ann.category}
                    </span>

                    {ann.priority === 'Urgent' && (
                      <span className="px-2 py-0.5 bg-rose-100 text-rose-700 border border-rose-200 rounded-md text-[9px] font-black uppercase tracking-wider flex items-center gap-1">
                        <AlertCircle className="w-2.5 h-2.5" />
                        <span>URGENT NOTICE</span>
                      </span>
                    )}

                    <span className="text-[10px] font-mono text-slate-400">
                      {new Date(ann.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </span>
                  </div>

                  <h4 className="font-extrabold text-slate-900 text-sm sm:text-base tracking-tight uppercase">
                    {ann.title}
                  </h4>

                  <p className="text-slate-600 text-xs sm:text-sm leading-relaxed font-medium">
                    {ann.content}
                  </p>

                  <div className="flex items-center gap-2 text-[10px] text-slate-400 font-bold">
                    <span>Issued by:</span>
                    <span className="text-slate-600 uppercase tracking-wide bg-slate-100 px-2 py-0.5 rounded-md">{ann.author}</span>
                  </div>
                </div>

                {isStaff && (
                  <button
                    onClick={() => handleDeleteAnnouncement(ann.id)}
                    className="p-2 hover:bg-rose-50 rounded-lg text-slate-400 hover:text-rose-600 transition-all shrink-0 self-end md:self-start cursor-pointer border border-transparent hover:border-rose-100"
                    title="Remove notice"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))
          ) : (
            <div className="p-16 text-center bg-slate-50 border border-slate-100 rounded-2xl">
              <MessageSquare className="w-10 h-10 text-slate-300 mx-auto mb-3" />
              <p className="font-bold text-slate-500 text-sm">No circular notices found</p>
              <p className="text-xs text-slate-400 mt-1">There are currently no active announcements published matching the chosen criteria.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
