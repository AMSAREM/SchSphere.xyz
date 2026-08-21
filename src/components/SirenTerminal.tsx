import React, { useState, useEffect, useRef } from 'react';
import { 
  Megaphone, 
  Volume2, 
  VolumeX, 
  AlertTriangle, 
  Flame, 
  CloudLightning, 
  Bell, 
  CheckCircle, 
  LogOut, 
  History, 
  Trash2, 
  Radio,
  FileSpreadsheet,
  Clock,
  User,
  ShieldCheck,
  Zap,
  Play,
  Square,
  Calendar,
  Edit2,
  Plus,
  Mic,
  Upload,
  Pause
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useNotifications } from '../contexts/NotificationContext';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../db/schema';
import { useLiveQuery } from 'dexie-react-hooks';

// Type definitions for alarms
type AlarmType = 'lockdown' | 'fire' | 'weather' | 'bell' | 'allclear';

interface AlarmConfig {
  id: AlarmType;
  label: string;
  description: string;
  severity: 'critical' | 'warning' | 'info' | 'success';
  icon: any;
  colorClass: string;
  bgPulseClass: string;
  strobeColors: string[];
}

interface AlertLog {
  id: string;
  type: AlarmType;
  label: string;
  triggeredBy: string;
  role: string;
  customMsg: string;
  timestamp: number;
  duration?: string;
  isDrill: boolean;
}

const ALARM_TYPES: AlarmConfig[] = [
  {
    id: 'lockdown',
    label: 'Lockdown Siren',
    description: 'Active threat warning. Sounds a double-modulation classic emergency security sweep. Alerts visual stroboscopes.',
    severity: 'critical',
    icon: AlertTriangle,
    colorClass: 'bg-red-600 text-white',
    bgPulseClass: 'bg-red-500/15',
    strobeColors: ['rgba(239, 68, 68, 0.45)', 'rgba(59, 130, 246, 0.45)']
  },
  {
    id: 'fire',
    label: 'Fire Drill / Evaculate',
    description: 'Immediate evacuation alarm. Plays a high-frequency piercing sweep pulsating at 3.5Hz rhythm cycles.',
    severity: 'critical',
    icon: Flame,
    colorClass: 'bg-orange-600 text-white',
    bgPulseClass: 'bg-orange-500/15',
    strobeColors: ['rgba(249, 115, 22, 0.5)', 'rgba(239, 68, 68, 0.1)']
  },
  {
    id: 'weather',
    label: 'Weather Warning',
    description: 'Severe meteorological warning. Generates a deep, pulsating, classic horn siren for active tornado/hurricane warnings.',
    severity: 'warning',
    icon: CloudLightning,
    colorClass: 'bg-amber-600 text-white',
    bgPulseClass: 'bg-amber-500/15',
    strobeColors: ['rgba(245, 158, 11, 0.4)', 'rgba(0, 0, 0, 0.05)']
  },
  {
    id: 'bell',
    label: 'School Period Bell',
    description: 'Class period notification. Emulates a classic metallic brass bell strike with fast decay ring modulator frequencies.',
    severity: 'info',
    icon: Bell,
    colorClass: 'bg-indigo-600 text-white',
    bgPulseClass: 'bg-indigo-500/10',
    strobeColors: ['rgba(99, 102, 241, 0.2)', 'rgba(99, 102, 241, 0.02)']
  },
  {
    id: 'allclear',
    label: 'All Clear Chime',
    description: 'Resolves ongoing alarms. Plays a soothing, major-arpeggio warm harmonic chime sequence to restore safe state.',
    severity: 'success',
    icon: CheckCircle,
    colorClass: 'bg-emerald-600 text-white',
    bgPulseClass: 'bg-emerald-500/15',
    strobeColors: ['rgba(16, 185, 129, 0.3)', 'rgba(16, 185, 129, 0.02)']
  }
];

export default function SirenTerminal() {
  const { user } = useAuth();
  const { showToast, confirm } = useNotifications();
  
  // Tab states for manually triggering vs timetable management vs custom recordings
  const [activeSubTab, setActiveSubTab] = useState<'triggers' | 'timetable' | 'recordings'>('triggers');

  const [activeAlarm, setActiveAlarm] = useState<AlarmType | null>(null);
  const [customAnnouncement, setCustomAnnouncement] = useState('');
  const [isDrill, setIsDrill] = useState(false);
  const [logs, setLogs] = useState<AlertLog[]>([]);
  const [activeStrobeColor, setActiveStrobeColor] = useState('transparent');
  const [pulseCount, setPulseCount] = useState(0);

  // Timetable bell scheduler form states
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [bellEditingId, setBellEditingId] = useState<string | null>(null);
  const [bellLabel, setBellLabel] = useState('');
  const [bellTime, setBellTime] = useState('08:00');
  const [bellDays, setBellDays] = useState<string[]>(['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']);
  const [bellTone, setBellTone] = useState<string>('bell');

  // Load database settings and volume level reactively
  const settingsArray = useLiveQuery(() => db.settings.toArray()) || [];

  // Audio recordings list
  const recordingsSetting = settingsArray.find(s => s.key === 'recordedAudioList');
  const recordedAudios = (recordingsSetting?.value || []) as Array<{
    id: string;
    name: string;
    base64: string;
    timestamp: number;
  }>;

  // MediaRecorder states
  const [isRecording, setIsRecording] = useState(false);
  const [recordDuration, setRecordDuration] = useState(0);
  const [recordTimerId, setRecordTimerId] = useState<any>(null);
  const [newRecordingName, setNewRecordingName] = useState('');
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  // Local playing audio states (for previewing in this tab)
  const [previewPlayingId, setPreviewPlayingId] = useState<string | null>(null);
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    return () => {
      // Cleanup preview and timers when unmounting
      if (previewAudioRef.current) {
        previewAudioRef.current.pause();
      }
      if (recordTimerId) {
        clearInterval(recordTimerId);
      }
    };
  }, [recordTimerId]);

  const startMicRecording = async () => {
    try {
      audioChunksRef.current = [];
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      recorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        
        // Stop stream tracks
        stream.getTracks().forEach((track) => track.stop());

        // Convert blob to base64
        const reader = new FileReader();
        reader.readAsDataURL(audioBlob);
        reader.onloadend = async () => {
          const base64data = reader.result as string;
          const recordingName = newRecordingName.trim() || `Voice Note - ${new Date().toLocaleTimeString('en-US', { hour12: false })}`;
          const newId = `rec-${Date.now()}`;
          const newRecord = {
            id: newId,
            name: recordingName,
            base64: base64data,
            timestamp: Date.now()
          };

          const updatedList = [newRecord, ...recordedAudios];
          const existing = await db.settings.where('key').equals('recordedAudioList').first();
          if (existing) {
            await db.settings.update(existing.id!, { value: updatedList });
          } else {
            await db.settings.add({ key: 'recordedAudioList', value: updatedList });
          }
          showToast(`Successfully saved recording: "${recordingName}"!`, "success");
          setNewRecordingName('');
        };
      };

      recorder.start();
      setIsRecording(true);
      setRecordDuration(0);

      const tid = setInterval(() => {
        setRecordDuration((prev) => {
          if (prev >= 59) {
            // Auto stop at max duration limit (60s)
            stopMicRecording();
            return 60;
          }
          return prev + 1;
        });
      }, 1000);
      setRecordTimerId(tid);

      showToast("Recording broadcasting announcement started!", "info");
    } catch (err: any) {
      console.error("Recording error:", err);
      showToast("Unable to use microphone. Check browser permissions or upload an audio file instead.", "error");
    }
  };

  const stopMicRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try {
        mediaRecorderRef.current.stop();
      } catch (e) {}
    }
    setIsRecording(false);
    if (recordTimerId) {
      clearInterval(recordTimerId);
      setRecordTimerId(null);
    }
  };

  const handleAudioUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 8 * 1024 * 1024) {
      showToast("Audio file is too large! Maximum limit is 8MB.", "error");
      return;
    }

    const name = file.name.replace(/\.[^/.]+$/, ""); // strip extension

    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = async () => {
      const base64 = reader.result as string;
      const newRecord = {
        id: `rec-${Date.now()}`,
        name: name || "Uploaded Announcement",
        base64,
        timestamp: Date.now()
      };

      const updatedList = [newRecord, ...recordedAudios];
      const existing = await db.settings.where('key').equals('recordedAudioList').first();
      if (existing) {
        await db.settings.update(existing.id!, { value: updatedList });
      } else {
        await db.settings.add({ key: 'recordedAudioList', value: updatedList });
      }

      showToast(`Audio "${name}" uploaded successfully!`, "success");
    };
    reader.onerror = () => {
      showToast("Failed to parse the selected audio file.", "error");
    };
  };

  const handleDeleteRecording = async (id: string, name: string) => {
    const okay = await confirm({
      title: "Delete Custom Audio?",
      message: `Permanently delete "${name}"? Traditional schedule items or active triggers using this audio will no longer play.`,
      confirmLabel: "Delete Recording"
    });
    if (!okay) return;

    // stop preview if playing
    if (previewPlayingId === id && previewAudioRef.current) {
      previewAudioRef.current.pause();
      setPreviewPlayingId(null);
    }

    const updatedList = recordedAudios.filter(r => r.id !== id);
    const existing = await db.settings.where('key').equals('recordedAudioList').first();
    if (existing) {
      await db.settings.update(existing.id!, { value: updatedList });
    } else {
      await db.settings.add({ key: 'recordedAudioList', value: updatedList });
    }
    showToast(`Deleted "${name}"`, "info");
  };

  const handlePreviewPlay = (item: any) => {
    if (previewPlayingId === item.id) {
      if (previewAudioRef.current) {
        previewAudioRef.current.pause();
        previewAudioRef.current = null;
      }
      setPreviewPlayingId(null);
    } else {
      if (previewAudioRef.current) {
        previewAudioRef.current.pause();
      }

      const audio = new Audio(item.base64);
      audio.volume = acousticVolume;
      audio.onended = () => {
        setPreviewPlayingId(null);
      };
      previewAudioRef.current = audio;
      setPreviewPlayingId(item.id);
      audio.play().catch(err => {
        console.error("Playback failed:", err);
        showToast("Audio playback blocked. Interactive triggers are required by your browser.", "error");
        setPreviewPlayingId(null);
      });
    }
  };

  const handleBroadcastRecordedAudio = async (item: any) => {
    showToast(`Broadcasting: "${item.name}" live over local and client intercoms!`, "success");
    const payload = {
      type: `recorded:${item.id}`,
      label: item.name,
      customMsg: `LIVE INTERCOM MESSAGE: "${item.name}". Please listen to the speaker.`,
      isDrill: false,
      triggeredBy: user?.fullName || 'Campus Administrator',
      timestamp: Date.now()
    };
    const existing = await db.settings.where('key').equals('activeSirenBroadcast').first();
    if (existing) {
      await db.settings.update(existing.id!, { value: payload });
    } else {
      await db.settings.add({ key: 'activeSirenBroadcast', value: payload });
    }
  };
  const volumeSetting = settingsArray.find(s => s.key === 'acousticVolume');
  const acousticVolume = volumeSetting?.value ?? 0.5;

  const isMutedSetting = settingsArray.find(s => s.key === 'isGloballyMuted');
  const isGloballyMuted = isMutedSetting?.value === true;

  const setIsGloballyMuted = async (muted: boolean) => {
    const existing = await db.settings.where('key').equals('isGloballyMuted').first();
    if (existing) {
      await db.settings.update(existing.id!, { value: muted });
    } else {
      await db.settings.add({ key: 'isGloballyMuted', value: muted });
    }
  };

  const scheduleSetting = settingsArray.find(s => s.key === 'bellSchedule');
  const bellSchedule = (scheduleSetting?.value || []) as Array<{
    id: string;
    label: string;
    time: string;
    days: string[];
    alarmType: AlarmType;
    enabled: boolean;
  }>;

  const DEFAULT_BELLS = [
    { id: 'bell-1', label: 'Morning General Assembly', time: '07:30', days: ['Monday', 'Friday'], alarmType: 'bell', enabled: true },
    { id: 'bell-2', label: 'Period 1 Start', time: '08:00', days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'], alarmType: 'bell', enabled: true },
    { id: 'bell-3', label: 'Mid-Morning Play Break', time: '10:00', days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'], alarmType: 'allclear', enabled: true },
    { id: 'bell-4', label: 'Lunch Recess Intermission', time: '12:00', days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'], alarmType: 'allclear', enabled: true },
    { id: 'bell-5', label: 'Afternoon Period 5 Resume', time: '13:00', days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'], alarmType: 'bell', enabled: true },
    { id: 'bell-6', label: 'Closing & Campus Dismissal', time: '15:30', days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'], alarmType: 'bell', enabled: true },
  ];

  const handleSeedDefaults = async () => {
    const existing = await db.settings.where('key').equals('bellSchedule').first();
    if (existing) {
      await db.settings.update(existing.id!, { value: DEFAULT_BELLS });
    } else {
      await db.settings.add({ key: 'bellSchedule', value: DEFAULT_BELLS });
    }
    showToast("Successfully loaded standard school period bells!", "success");
  };

  const handleToggleBell = async (id: string) => {
    const newList = bellSchedule.map((b: any) => 
      b.id === id ? { ...b, enabled: !b.enabled } : b
    );
    const existing = await db.settings.where('key').equals('bellSchedule').first();
    if (existing) {
      await db.settings.update(existing.id!, { value: newList });
    } else {
      await db.settings.add({ key: 'bellSchedule', value: newList });
    }
  };

  const handleSaveBell = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bellLabel.trim()) {
      showToast("Please enter a clear label for the period ring", "error");
      return;
    }
    if (bellDays.length === 0) {
      showToast("Please select at least one day", "error");
      return;
    }

    let newList = [...bellSchedule];
    if (bellEditingId) {
      newList = newList.map((b: any) => 
        b.id === bellEditingId 
          ? { ...b, label: bellLabel.trim(), time: bellTime, days: bellDays, alarmType: bellTone as AlarmType }
          : b
      );
    } else {
      newList.push({
        id: `bell-${Date.now()}`,
        label: bellLabel.trim(),
        time: bellTime,
        days: bellDays,
        alarmType: bellTone as AlarmType,
        enabled: true
      });
    }

    // Sort by time ascending
    newList.sort((a: any, b: any) => a.time.localeCompare(b.time));

    const existing = await db.settings.where('key').equals('bellSchedule').first();
    if (existing) {
      await db.settings.update(existing.id!, { value: newList });
    } else {
      await db.settings.add({ key: 'bellSchedule', value: newList });
    }

    showToast(bellEditingId ? "Scheduled bell updated!" : "New scheduled bell added!", "success");
    setIsFormOpen(false);
    setBellEditingId(null);
    setBellLabel('');
    setBellTime('08:00');
    setBellDays(['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']);
    setBellTone('bell');
  };

  const handleStartEditBell = (b: any) => {
    setBellEditingId(b.id);
    setBellLabel(b.label);
    setBellTime(b.time);
    setBellDays(b.days);
    setBellTone(b.alarmType || 'bell');
    setIsFormOpen(true);
  };

  const handleDeleteBell = async (id: string) => {
    const okay = await confirm({
      title: "Remove Period Bell?",
      message: "Are you sure you want to delete this scheduled bell alert from the school timetable? This cannot be undone.",
      confirmLabel: "Delete Ring"
    });
    if (!okay) return;

    const newList = bellSchedule.filter((b: any) => b.id !== id);
    const existing = await db.settings.where('key').equals('bellSchedule').first();
    if (existing) {
      await db.settings.update(existing.id!, { value: newList });
    } else {
      await db.settings.add({ key: 'bellSchedule', value: newList });
    }
    showToast("Scheduled bell successfully deleted", "info");
  };

  const handleTestRing = async (type: AlarmType, label: string) => {
    showToast(`Simulating ring chime for: "${label}"`, "info");
    const payload = {
      type,
      label: `${label} (Manual Playback Test)`,
      customMsg: `Testing active timetable ring chime. Confirm intercom is functioning properly.`,
      isDrill: true,
      triggeredBy: user?.fullName || 'Administrator (Manual Test)',
      timestamp: Date.now()
    };
    const existing = await db.settings.where('key').equals('activeSirenBroadcast').first();
    if (existing) {
      await db.settings.update(existing.id!, { value: payload });
    } else {
      await db.settings.add({ key: 'activeSirenBroadcast', value: payload });
    }
  };

  // Strobe effect tracking
  const strobeIntervalRef = useRef<any>(null);

  // Load history logs on mount
  useEffect(() => {
    const savedLogs = localStorage.getItem('esepa_siren_logs');
    if (savedLogs) {
      try {
        setLogs(JSON.parse(savedLogs));
      } catch (e) {
        console.error("Failed to parse siren logs:", e);
      }
    }
  }, []);

  // Sync active alarm from global broadcast state in db settings
  const activeGlobalBroadcast = settingsArray?.find(s => s.key === 'activeSirenBroadcast')?.value;

  useEffect(() => {
    if (activeGlobalBroadcast) {
      if (activeGlobalBroadcast.type !== activeAlarm) {
        setActiveAlarm(activeGlobalBroadcast.type);
        setCustomAnnouncement(activeGlobalBroadcast.customMsg || '');
        setIsDrill(activeGlobalBroadcast.isDrill || false);
      }
    } else {
      if (activeAlarm) {
        setActiveAlarm(null);
      }
    }
  }, [activeGlobalBroadcast]);

  // Handle strobe lighting updates
  useEffect(() => {
    if (activeAlarm) {
      const config = ALARM_TYPES.find(a => a.id === activeAlarm);
      if (config) {
        const colors = config.strobeColors;
        let index = 0;
        strobeIntervalRef.current = setInterval(() => {
          setActiveStrobeColor(colors[index % colors.length]);
          setPulseCount(p => p + 1);
          index++;
        }, activeAlarm === 'lockdown' ? 400 : activeAlarm === 'fire' ? 280 : 600);
      }
    } else {
      if (strobeIntervalRef.current) {
        clearInterval(strobeIntervalRef.current);
      }
      setActiveStrobeColor('transparent');
      setPulseCount(0);
    }

    return () => {
      if (strobeIntervalRef.current) clearInterval(strobeIntervalRef.current);
    };
  }, [activeAlarm]);

  // Live volume adjust slider saved directly to IndexedDb settings
  const handleVolumeChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    const existing = await db.settings.where('key').equals('acousticVolume').first();
    if (existing) {
      await db.settings.update(existing.id!, { value: val });
    } else {
      await db.settings.add({ key: 'acousticVolume', value: val });
    }
  };

  // Trigger Local UI Broadcast initiation
  const handleTriggerAlarm = async (type: AlarmType) => {
    const config = ALARM_TYPES.find(a => a.id === type)!;

    // For critical lockdown/fire alarms, enforce confirmation prompt
    if (config.severity === 'critical') {
      const isConfirmed = window.confirm(`🚨 EMERGENCY ALARM TRIGGER ACTION REQUIRED 🚨\n\nAre you sure you want to sound the absolute "${config.label}" alarm campus-wide?\n\nThis will trigger visual warning alerts throughout the school and activate local warning synthesizers.`);
      if (!isConfirmed) return;
    }

    try {
      // Create db save profile for activeSirenBroadcast to sync with other sessions
      const broadcastValue = {
        type,
        label: config.label,
        customMsg: customAnnouncement.trim(),
        isDrill,
        triggeredBy: user?.fullName || 'Administrator',
        timestamp: Date.now()
      };

      const existingBroadcast = settingsArray?.find(s => s.key === 'activeSirenBroadcast');
      if (existingBroadcast) {
        await db.settings.update(existingBroadcast.id!, { value: broadcastValue });
      } else {
        await db.settings.add({ key: 'activeSirenBroadcast', value: broadcastValue });
      }

      // Add log
      const newLog: AlertLog = {
        id: `LOG-${Date.now()}`,
        type,
        label: config.label,
        customMsg: customAnnouncement.trim() || 'Standard broadcast triggered.',
        isDrill,
        triggeredBy: user?.fullName || 'Elena (Admin)',
        role: user?.role || 'admin',
        timestamp: Date.now()
      };

      const updatedLogs = [newLog, ...logs];
      setLogs(updatedLogs);
      localStorage.setItem('esepa_siren_logs', JSON.stringify(updatedLogs));

      setActiveAlarm(type);

      showToast(`Activated Global Warning: ${config.label}`, 'success');
    } catch (err) {
      console.error(err);
      showToast('Failed to trigger alert.', 'error');
    }
  };

  // Squelch active globally
  const handleStopAlarm = async () => {
    try {
      const existingBroadcast = settingsArray?.find(s => s.key === 'activeSirenBroadcast');
      if (existingBroadcast) {
        await db.settings.delete(existingBroadcast.id!);
      }
      
      setActiveAlarm(null);
      setCustomAnnouncement('');
      setIsDrill(false);
      
      showToast('All campus siren alarms successfully deactivated.', 'info');
    } catch (err) {
      console.error(err);
      showToast('Failed to stop alarm.', 'error');
    }
  };

  const handleClearLogs = () => {
    if (window.confirm("Are you sure you want to permanently delete all historic campus security drill / alarm logs?")) {
      setLogs([]);
      localStorage.removeItem('esepa_siren_logs');
      showToast('Security logs wiped successfully.', 'info');
    }
  };

  const getSeverityBadgeClass = (severity: string) => {
    switch (severity) {
      case 'critical': return 'bg-rose-50 border border-rose-200 text-rose-700';
      case 'warning': return 'bg-amber-50 border border-amber-200 text-amber-700';
      case 'info': return 'bg-indigo-50 border border-indigo-200 text-indigo-700';
      case 'success': return 'bg-emerald-50 border border-emerald-200 text-emerald-700';
      default: return 'bg-slate-50 border border-slate-200 text-slate-700';
    }
  };

  return (
    <div className="space-y-6 select-none relative pb-12">
      {/* Full layout ambient strobe border for active alerts */}
      {activeAlarm && (
        <div 
          className="fixed inset-0 pointer-events-none transition-colors duration-200 z-50 mix-blend-color"
          style={{ 
            backgroundColor: activeStrobeColor,
            border: `12px solid ${activeStrobeColor}`
          }}
        />
      )}

      {/* Header section with live animation */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6 relative overflow-hidden">
        {activeAlarm && (
          <div className="absolute right-0 top-0 bottom-0 w-32 bg-gradient-to-l from-red-500/10 to-transparent flex items-center justify-end pr-8 pointer-events-none">
            <Radio className="w-12 h-12 text-rose-500 animate-ping absolute" />
            <Radio className="w-12 h-12 text-rose-600/70" />
          </div>
        )}
        <div className="space-y-1 relative z-10">
          <div className="flex items-center gap-2.5">
            <span className="p-2 rounded-xl bg-indigo-50 border border-indigo-100/80 text-indigo-600 block">
              <Megaphone className="w-6 h-6" />
            </span>
            <span className="text-xs font-black tracking-widest text-indigo-600 uppercase">Emergency Alert Console</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight pt-1">
            CAMPUC-WIDE SIREN & BROADCAST
          </h2>
          <p className="text-slate-500 text-sm max-w-2xl font-medium pt-1">
            Standard emergency warning panel linked dynamically to local browser Synthesizers. Sound lockdowns, configure scheduled alarm bells, draft drills, or broadcast safety instructions instantly.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 shrink-0">
          {activeAlarm ? (
            <button
              id="deactivate-siren"
              onClick={handleStopAlarm}
              className="px-6 py-4 bg-red-600 hover:bg-red-700 text-white font-extrabold text-sm rounded-xl transition-all shadow-lg shadow-red-600/20 active:scale-95 flex items-center justify-center gap-2 group animate-pulse"
            >
              <VolumeX className="w-5 h-5 group-hover:scale-110 transition-transform" />
              SQUELCH ALL SIRENS [STOP]
            </button>
          ) : (
            <div className="flex items-center gap-2.5 bg-slate-50 border border-slate-200 px-4 py-3 rounded-xl">
              <span className="h-3 w-3 rounded-full bg-emerald-500 border border-emerald-300 animate-pulse" />
              <span className="text-xs font-extrabold text-slate-700 uppercase tracking-wider">Campus Secure & Safe</span>
            </div>
          )}
        </div>
      </div>

      {/* Active Siren Banner Broadcast Visual */}
      <AnimatePresence>
        {activeAlarm && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className={`border rounded-2xl p-6 relative overflow-hidden shadow-md flex flex-col md:flex-row items-center justify-between gap-6 ${
              activeAlarm === 'lockdown' ? 'bg-red-50 border-red-200 text-red-900' :
              activeAlarm === 'fire' ? 'bg-orange-50 border-orange-200 text-orange-900' :
              activeAlarm === 'weather' ? 'bg-amber-50 border-amber-200 text-amber-900' :
              activeAlarm === 'allclear' ? 'bg-emerald-50 border-emerald-200 text-emerald-950' :
              'bg-indigo-50 border-indigo-200 text-indigo-950'
            }`}
          >
            <div className="flex items-center gap-4">
              <div className={`p-4 rounded-2xl shrink-0 animate-bounce ${
                activeAlarm === 'lockdown' ? 'bg-red-600 text-white shadow-md shadow-red-500/20' :
                activeAlarm === 'fire' ? 'bg-orange-600 text-white shadow-md shadow-orange-500/20' :
                activeAlarm === 'weather' ? 'bg-amber-600 text-white' :
                'bg-indigo-600 text-white'
              }`}>
                <AlertTriangle className="w-8 h-8" />
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs uppercase font-extrabold tracking-widest px-2.5 py-0.5 rounded-full bg-red-600 text-white animate-pulse">
                    {isDrill ? 'DRILL IN PROGRESS' : 'ACTIVE EMERGENCY'}
                  </span>
                  <span className="text-xs font-bold text-slate-500">
                    Triggered by {activeGlobalBroadcast?.triggeredBy || 'Elena (Admin)'}
                  </span>
                </div>
                <h3 className="text-xl font-black tracking-tight">{activeGlobalBroadcast?.label || 'Active Siren Alert'}</h3>
                <p className="text-sm font-semibold opacity-90 italic">
                  "{activeGlobalBroadcast?.customMsg || 'Attention: Follow safety guidelines and shelter or relocate immediately.'}"
                </p>
              </div>
            </div>

            {/* Synth Acoustic visual waves */}
            <div className="shrink-0 flex items-center gap-6">
              <div className="flex items-end gap-1.5 h-10 w-24">
                {[1, 2, 3, 4, 5, 6, 7].map((bar) => (
                  <div
                    key={bar}
                    className={`w-2.5 rounded-full ${
                      activeAlarm === 'lockdown' ? 'bg-red-600' :
                      activeAlarm === 'fire' ? 'bg-orange-600' :
                      'bg-indigo-600'
                    }`}
                    style={{
                      height: `${10 + Math.abs(Math.sin((pulseCount / 2) + bar) * 30)}px`,
                      transition: 'height 0.15s ease-in-out'
                    }}
                  />
                ))}
              </div>

              {/* Individual sound monitor mute */}
              <button
                onClick={() => setIsGloballyMuted(!isGloballyMuted)}
                className="px-4 py-2 text-xs font-black rounded-lg bg-white/80 hover:bg-white text-slate-800 flex items-center gap-1.5 border border-slate-200 shadow-sm"
                title="Silence sound locally inside this tab"
              >
                {isGloballyMuted ? <VolumeX className="w-4 h-4 text-red-650" /> : <Volume2 className="w-4 h-4 text-slate-650" />}
                {isGloballyMuted ? "Unmute Campus Speaker" : "Mute Tab Speaker"}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Tab Switcher - Manual Emergency vs Scheduled Timetable Bells */}
      <div className="flex border-b border-slate-250 gap-6 overflow-x-auto pb-1">
        <button
          onClick={() => setActiveSubTab('triggers')}
          className={`pb-3 text-xs sm:text-sm font-extrabold tracking-wider uppercase border-b-2 transition-all flex items-center gap-2 shrink-0 ${
            activeSubTab === 'triggers' 
              ? 'border-indigo-600 text-indigo-600' 
              : 'border-transparent text-slate-400 hover:text-slate-600'
          }`}
        >
          <Radio className="w-4 h-4" />
          Active Sirens & Broadcast
        </button>
        <button
          onClick={() => setActiveSubTab('timetable')}
          className={`pb-3 text-xs sm:text-sm font-extrabold tracking-wider uppercase border-b-2 transition-all flex items-center gap-2 shrink-0 ${
            activeSubTab === 'timetable' 
              ? 'border-indigo-600 text-indigo-600' 
              : 'border-transparent text-slate-400 hover:text-slate-600'
          }`}
          id="tab-timetable-bell"
        >
          <Calendar className="w-4 h-4" />
          Period Bell Timetable ({bellSchedule.length})
        </button>
        <button
          onClick={() => setActiveSubTab('recordings')}
          className={`pb-3 text-xs sm:text-sm font-extrabold tracking-wider uppercase border-b-2 transition-all flex items-center gap-2 shrink-0 ${
            activeSubTab === 'recordings' 
              ? 'border-indigo-600 text-indigo-600' 
              : 'border-transparent text-slate-400 hover:text-slate-600'
          }`}
          id="tab-recordings"
        >
          <Mic className="w-4 h-4" />
          Recorded Announcements ({recordedAudios.length})
        </button>
      </div>

      {/* Control Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left 2 cols: Dynamic Tab content (Trigger alarms or Timetable bell schedule) */}
        <div className="lg:col-span-2 space-y-6">
          {activeSubTab === 'triggers' && (
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-6">
              <h3 className="text-md font-black text-slate-950 uppercase tracking-wider flex items-center gap-2">
                <Radio className="w-5 h-5 text-indigo-600" />
                1. Construct Alarm Settings & Announcements
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-extrabold text-slate-500 uppercase tracking-widest">
                    Custom Broadcast Message (Appears visual everywhere)
                  </label>
                  <textarea
                    value={customAnnouncement}
                    onChange={(e) => setCustomAnnouncement(e.target.value)}
                    placeholder="e.g. Active Lockdown Drill. Complete security protocols, locked doors, clear the hallways."
                    className="w-full h-24 border border-slate-200 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 resize-none font-medium text-slate-800"
                  />
                </div>

                <div className="flex flex-col justify-between p-4 bg-slate-50 border border-slate-100 rounded-2xl gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-extrabold text-slate-500 uppercase tracking-widest">Acoustic Audio Settings</span>
                      <span className="text-xs font-mono font-bold text-slate-600">{Math.round(acousticVolume * 100)}% volume</span>
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <Volume2 className="w-4 h-4 text-slate-400" />
                      <input 
                        type="range"
                        min="0"
                        max="1"
                        step="0.05"
                        value={acousticVolume}
                        onChange={handleVolumeChange}
                        className="w-full accent-indigo-600 h-1.5 bg-slate-200 rounded-lg cursor-pointer"
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between border-t border-slate-200/60 pt-3">
                    <div className="space-y-0.5">
                      <span className="text-xs font-extrabold text-slate-800">Trigger as Drill/Simulation</span>
                      <p className="text-[10px] text-slate-500">Will mark the alarm header clearly as a school safety drill.</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input 
                        type="checkbox" 
                        className="sr-only peer"
                        checked={isDrill}
                        onChange={(e) => setIsDrill(e.target.checked)}
                      />
                      <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                    </label>
                  </div>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-100 space-y-4">
                <span className="text-xs font-extrabold text-slate-500 uppercase tracking-widest block">
                  2. Tap Trigger to broadcast & Play sound
                </span>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {ALARM_TYPES.map((alarm) => {
                    const Icon = alarm.icon;
                    const isCurrentlyActive = activeAlarm === alarm.id;
                    
                    return (
                      <div 
                        key={alarm.id}
                        className={`border rounded-2xl p-4 flex flex-col justify-between transition-all group ${
                          isCurrentlyActive 
                            ? 'border-red-500 bg-red-50/20 shadow-sm' 
                            : 'border-slate-200/80 hover:border-slate-300 hover:bg-slate-50/50'
                        }`}
                      >
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <span className={`p-1.5 rounded-lg text-xs leading-none font-bold uppercase ${
                              alarm.id === 'lockdown' ? 'bg-red-100 text-red-700' :
                              alarm.id === 'fire' ? 'bg-orange-100 text-orange-700' :
                              alarm.id === 'weather' ? 'bg-amber-100 text-amber-700' :
                              alarm.id === 'allclear' ? 'bg-emerald-100 text-emerald-700' :
                              'bg-indigo-100 text-indigo-700'
                            }`}>
                              {alarm.severity}
                            </span>
                            
                            {isCurrentlyActive && (
                              <span className="h-2 w-2 rounded-full bg-red-600 animate-ping" />
                            )}
                          </div>
                          <h4 className="text-sm font-black text-slate-900 flex items-center gap-1.5">
                            <Icon className={`w-4 h-4 ${
                              alarm.id === 'lockdown' ? 'text-red-600' :
                              alarm.id === 'fire' ? 'text-orange-600' :
                              'text-slate-500 group-hover:text-indigo-600'
                            }`} />
                            {alarm.label}
                          </h4>
                          <p className="text-xs text-slate-500 leading-relaxed font-medium">
                            {alarm.description}
                          </p>
                        </div>

                        <div className="pt-4 flex items-center gap-2">
                          {isCurrentlyActive ? (
                            <button
                              onClick={handleStopAlarm}
                              className="w-full py-2 bg-slate-900 text-white font-bold text-xs rounded-xl hover:bg-black transition-all flex items-center justify-center gap-1"
                            >
                              <Square className="w-3.5 h-3.5" />
                              Stop Sound
                            </button>
                          ) : (
                            <button
                              onClick={() => handleTriggerAlarm(alarm.id)}
                              className={`w-full py-2 font-black text-xs rounded-xl flex items-center justify-center gap-1 transition-all shadow-sm ${
                                alarm.id === 'lockdown' ? 'bg-red-600 text-white hover:bg-red-700 shadow-red-600/10' :
                                alarm.id === 'fire' ? 'bg-orange-600 text-white hover:bg-orange-700 shadow-orange-600/10' :
                                alarm.id === 'weather' ? 'bg-amber-600 text-white hover:bg-amber-700' :
                                alarm.id === 'allclear' ? 'bg-emerald-600 text-white hover:bg-emerald-700' :
                                'bg-indigo-600 text-white hover:bg-indigo-700'
                              }`}
                            >
                              <Play className="w-3 h-3 fill-current" />
                              ACTIVATE ALARM
                            </button>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          )}

          {activeSubTab === 'timetable' && (
            <div className="space-y-6">
              {/* Timetable Header */}
              <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <h3 className="text-md font-black text-slate-950 uppercase tracking-wider flex items-center gap-2">
                      <Calendar className="w-5 h-5 text-indigo-600" />
                      Automated Period Chime Scheduler
                    </h3>
                    <p className="text-xs text-slate-500 font-semibold leading-relaxed">
                      Configure scheduled alarms/bells to trigger automatically throughout the active school week.
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleSeedDefaults}
                      className="px-3.5 py-2 border border-slate-200 hover:bg-slate-50 text-slate-705 text-xs font-bold rounded-xl transition-all"
                      title="Reset timetable bells back to standard Ghanaian period templates"
                      type="button"
                    >
                      Use Templates
                    </button>

                    <button
                      onClick={() => {
                        setBellEditingId(null);
                        setBellLabel('');
                        setBellTime('08:00');
                        setBellDays(['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']);
                        setBellTone('bell');
                        setIsFormOpen(!isFormOpen);
                      }}
                      className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black uppercase tracking-wider rounded-xl transition-all shadow-md shadow-indigo-600/15 flex items-center gap-1.5"
                      type="button"
                    >
                      <Plus className="w-4 h-4" />
                      {isFormOpen ? 'Minimize Form' : 'Add Chime'}
                    </button>
                  </div>
                </div>

                {/* Operational Note clue */}
                <div className="p-3.5 bg-indigo-50/55 border border-indigo-100 rounded-xl flex items-start gap-2 text-[11px] text-indigo-900 leading-relaxed font-semibold">
                  <span className="text-indigo-600 text-sm">💡</span>
                  <span>
                    <strong>Automatic Intercom Trigger Engine:</strong> The School Sphere core background scanner scans active timetable items continuously. If a bell's checked weekdays and target time match the server/local clock, the alert chimes globally in all active tabs instantly.
                  </span>
                </div>
              </div>

              {/* Form Expandable */}
              <AnimatePresence>
                {isFormOpen && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="overflow-hidden"
                  >
                    <form 
                      onSubmit={handleSaveBell}
                      className="bg-slate-50 border border-slate-200 rounded-2xl p-5 sm:p-6 space-y-4"
                    >
                      <h4 className="text-xs font-black text-slate-900 uppercase tracking-widest flex items-center gap-1.5 border-b border-slate-200 pb-2">
                        <Plus className="w-4 h-4 text-indigo-600" />
                        {bellEditingId ? 'Modifying Registered Period Ring' : 'Add New Automatic Timetable Bell Alert'}
                      </h4>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider">
                            Ring Chime Label
                          </label>
                          <input
                            type="text"
                            value={bellLabel}
                            onChange={(e) => setBellLabel(e.target.value)}
                            placeholder="e.g. Period 1 Start"
                            className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-semibold text-slate-800"
                          />
                        </div>

                        <div className="space-y-1.5">
                          <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block">
                            Trigger Time (24 hour hh:mm)
                          </label>
                          <input
                            type="time"
                            value={bellTime}
                            required
                            onChange={(e) => setBellTime(e.target.value)}
                            className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-mono font-semibold text-slate-800"
                          />
                        </div>

                        <div className="space-y-1.5">
                          <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider">
                            Intercom Siren Chime Sound
                          </label>
                          <select
                            value={bellTone}
                            onChange={(e) => setBellTone(e.target.value)}
                            className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-semibold text-slate-800 bg-white"
                          >
                            <optgroup label="Core Alarm Sirens & Chimes">
                              <option value="bell">🛎 Standard Period Bell Strike</option>
                              <option value="allclear">🎵 Musical Comfort Chord (Recess/Play)</option>
                              <option value="weather">🌪 Severe Weather Warning Drone</option>
                              <option value="fire">🚨 Piercing Emergency Sweep (Fire Alert)</option>
                            </optgroup>
                            {recordedAudios.length > 0 && (
                              <optgroup label="Your Custom Recorded Announcements">
                                {recordedAudios.map(audio => (
                                  <option key={audio.id} value={`recorded:${audio.id}`}>
                                    🎙 {audio.name}
                                  </option>
                                ))}
                              </optgroup>
                            )}
                          </select>
                        </div>
                      </div>

                      {/* Weekday Selection checkboxes */}
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block">
                          Trigger on Weekdays
                        </label>
                        <div className="flex flex-wrap gap-1.5">
                          {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map((day) => {
                            const isChecked = bellDays.includes(day);
                            return (
                              <button
                                type="button"
                                key={day}
                                onClick={() => {
                                  if (isChecked) {
                                    setBellDays(bellDays.filter(d => d !== day));
                                  } else {
                                    setBellDays([...bellDays, day]);
                                  }
                                }}
                                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${
                                  isChecked 
                                    ? 'bg-indigo-600 border-indigo-600 text-white' 
                                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                                }`}
                              >
                                {day.slice(0, 3)}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200/60">
                        <button
                          type="button"
                          onClick={() => {
                            setIsFormOpen(false);
                            setBellEditingId(null);
                          }}
                          className="px-4 py-2 hover:bg-slate-200 text-slate-600 text-xs font-black uppercase tracking-wider rounded-xl transition-all"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black uppercase tracking-wider rounded-xl transition-all shadow-md shadow-indigo-600/10"
                        >
                          {bellEditingId ? 'Save Changes' : 'Register Chime'}
                        </button>
                      </div>
                    </form>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Empty State Seed prompt */}
              {bellSchedule.length === 0 && (
                <div className="text-center py-12 bg-white border border-slate-100 rounded-2xl p-8">
                  <Calendar className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                  <h3 className="text-sm font-black text-slate-800 uppercase tracking-wide">No scheduled timetabled rings configured</h3>
                  <p className="text-xs text-slate-500 max-w-sm mx-auto mt-2 leading-relaxed">
                    Let the system automate your classroom bells! Create custom period alarms, breakfast recesses, assembly alarms, or afternoon closing chimes.
                  </p>
                  <button
                    onClick={handleSeedDefaults}
                    className="mt-4 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black uppercase tracking-wider rounded-xl transition-all shadow-md shadow-indigo-600/10 inline-flex items-center gap-1.5"
                    type="button"
                  >
                    <Plus className="w-4 h-4" />
                    Pre-load Standard Period Bells
                  </button>
                </div>
              )}

              {/* Scheduled Bells List */}
              {bellSchedule.length > 0 && (
                <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-6 shadow-sm space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <h4 className="text-xs font-black text-slate-900 uppercase tracking-widest">
                      Registered Time Schedule Run ({bellSchedule.length} bells)
                    </h4>
                    <div className="text-[10px] font-bold text-slate-500 flex items-center gap-1">
                      <span className="h-1.5 w-1.5 bg-emerald-500 rounded-full animate-ping" />
                      Active & Armed
                    </div>
                  </div>

                  <div className="divide-y divide-slate-100">
                    {bellSchedule.map((b) => {
                      return (
                        <div 
                          key={b.id}
                          className={`py-3.5 flex flex-col md:flex-row md:items-center justify-between gap-4 transition-colors ${
                            b.enabled ? 'opacity-100' : 'opacity-60 bg-slate-50/20'
                          }`}
                        >
                          <div className="flex items-center gap-3.5 min-w-0">
                            {/* Clock Badgify */}
                            <div className="bg-slate-900 text-white px-3.5 py-1.5 rounded-xl flex flex-col items-center justify-center shrink-0 shadow-sm border border-slate-800">
                              <span className="font-mono text-xs sm:text-sm font-black tracking-tight">{b.time}</span>
                              <span className="text-[8px] font-bold text-slate-400 tracking-widest uppercase">
                                {parseInt(b.time.split(':')[0]) >= 12 ? 'PM' : 'AM'}
                              </span>
                            </div>

                            <div className="space-y-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <h5 className="text-sm font-black text-slate-900 truncate">
                                  {b.label}
                                </h5>
                                <span className={`px-2 py-0.5 rounded-md text-[9px] font-extrabold uppercase shrink-0 ${
                                  b.alarmType === 'bell' ? 'bg-indigo-50 text-indigo-700 border border-indigo-100' :
                                  b.alarmType === 'allclear' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' :
                                  b.alarmType === 'weather' ? 'bg-amber-50 text-amber-700 border border-amber-100' :
                                  'bg-teal-50 text-teal-700 border border-teal-100'
                                }`}>
                                  {b.alarmType.startsWith('recorded:') ? '🎙 Recorded Voice' : b.alarmType}
                                </span>
                              </div>
                              
                              {/* Days list */}
                              <div className="flex flex-wrap items-center gap-1">
                                {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'].map((day) => {
                                  const daySelected = b.days.includes(day);
                                  return (
                                    <span 
                                      key={day} 
                                      className={`text-[9px] font-bold px-1.5 py-0.2 rounded ${
                                        daySelected 
                                          ? 'bg-slate-100 text-slate-800 font-extrabold border border-slate-200' 
                                          : 'text-slate-300'
                                      }`}
                                    >
                                      {day.slice(0, 3)}
                                    </span>
                                  );
                                })}
                                {b.days.includes('Saturday') && (
                                  <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-amber-50 text-amber-700 border border-amber-150">Sat</span>
                                )}
                                {b.days.includes('Sunday') && (
                                  <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-amber-50 text-amber-700 border border-amber-150">Sun</span>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Actions bar for each row */}
                          <div className="flex items-center justify-end gap-2.5 self-end md:self-auto shrink-0">
                            {/* Enable toggle checkbox switch slider style */}
                            <div className="flex items-center gap-1.5 mr-2">
                              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                {b.enabled ? 'Armed' : 'Disarmed'}
                              </span>
                              <label className="relative inline-flex items-center cursor-pointer">
                                <input 
                                  type="checkbox" 
                                  className="sr-only peer"
                                  checked={b.enabled}
                                  onChange={() => handleToggleBell(b.id)}
                                />
                                <div className="w-10 h-5.5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4.5 after:w-4.5 after:transition-all peer-checked:bg-indigo-600"></div>
                              </label>
                            </div>

                            {/* Simulation Playback test sound bell */}
                            <button
                              onClick={() => handleTestRing(b.alarmType, b.label)}
                              className="p-1 px-2 text-xs font-extrabold bg-indigo-50 hover:bg-indigo-100 border border-indigo-250 text-indigo-700 rounded-lg transition-all inline-flex items-center gap-1 text-[11px]"
                              title="Strike this chime now over active intercom speakers for testing"
                              type="button"
                            >
                              <Volume2 className="w-3.5 h-3.5" />
                              Test Ring
                            </button>

                            {/* Edit details */}
                            <button 
                              onClick={() => handleStartEditBell(b)}
                              className="p-1.5 bg-slate-50 hover:bg-slate-100 text-slate-500 hover:text-indigo-600 border border-slate-200 rounded-lg transition-all"
                              title="Edit Bell Chime Details"
                              type="button"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>

                            {/* Delete detail */}
                            <button 
                              onClick={() => handleDeleteBell(b.id)}
                              className="p-1.5 bg-slate-50 hover:bg-red-50 text-slate-500 hover:text-red-650 border border-slate-200 hover:border-red-200 rounded-lg transition-all"
                              title="Remove Period from Timetable"
                              type="button"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {activeSubTab === 'recordings' && (
            <div className="space-y-6">
              {/* Header Box */}
              <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <h3 className="text-md font-black text-slate-950 uppercase tracking-wider flex items-center gap-2">
                      <Mic className="w-5 h-5 text-indigo-600" />
                      Recorded Audio Intercom & Playback
                    </h3>
                    <p className="text-xs text-slate-500 font-semibold leading-relaxed">
                      Record live vocal announcements or upload pre-recorded chimes for campus-wide alerts or scheduled bells.
                    </p>
                  </div>
                </div>

                {/* Practical info banner */}
                <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl flex items-start gap-2 text-[11px] text-slate-800 leading-relaxed font-semibold">
                  <span className="text-indigo-600 text-sm">💡</span>
                  <span>
                    <strong>Voice Intercom Broadcast:</strong> You can record announcements directly from your browser microphone or upload any standard classroom audio message. These custom sounds can then be played live across all client computers instantly or automated through the bell scheduler!
                  </span>
                </div>
              </div>

              {/* Grid: Recorder Panel vs File Uploader */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* 1. Microphone Recorder */}
                <div className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 shadow-sm space-y-4 flex flex-col justify-between">
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
                      <Mic className="text-indigo-600 w-4.5 h-4.5" />
                      <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider">Direct Microphone Recorder</h4>
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider">
                        Recording Title / Name
                      </label>
                      <input
                        type="text"
                        value={newRecordingName}
                        onChange={(e) => setNewRecordingName(e.target.value)}
                        placeholder="e.g. Daily Devotion Broadcast"
                        className="w-full border border-slate-200 rounded-xl px-3.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-semibold text-slate-800"
                        disabled={isRecording}
                      />
                    </div>

                    {isRecording ? (
                      <div className="p-4 bg-red-50 border border-red-100 rounded-xl flex flex-col items-center justify-center space-y-3.5">
                        <div className="flex items-center gap-2">
                          <span className="h-3 w-3 rounded-full bg-red-600 animate-ping" />
                          <span className="text-xs font-black text-red-700 uppercase tracking-widest">RECORDING LIVE AUDIO</span>
                        </div>

                        {/* Animated waveform effect */}
                        <div className="flex items-end justify-center gap-1 h-8 px-4">
                          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((bar) => (
                            <motion.div
                              key={bar}
                              className="w-1 bg-red-500 rounded-full"
                              animate={{
                                height: [8, 28, 14, 32, 8][bar % 5],
                              }}
                              transition={{
                                repeat: Infinity,
                                duration: 0.4 + (bar * 0.05),
                                ease: "easeInOut"
                              }}
                            />
                          ))}
                        </div>

                        <span className="font-mono text-lg font-black text-red-900">
                          {String(Math.floor(recordDuration / 60)).padStart(2, '0')}:
                          {String(recordDuration % 60).padStart(2, '0')} / 01:00
                        </span>
                        
                        <p className="text-[10px] text-red-650 font-bold text-center">
                          Max voice limit 60 seconds. Say your announcement in a clear voice.
                        </p>
                      </div>
                    ) : (
                      <div className="p-6 bg-slate-50 border border-slate-100 border-dashed rounded-xl flex flex-col items-center justify-center text-center space-y-2">
                        <div className="bg-slate-200 text-slate-600 p-2 rounded-full">
                          <Mic className="w-5 h-5" />
                        </div>
                        <p className="text-xs text-slate-500 font-semibold">Microphone Ready</p>
                        <p className="text-[10px] text-slate-400 max-w-[200px]">
                          Click Below to start recording your microphone and save custom audio.
                        </p>
                      </div>
                    )}
                  </div>

                  <div className="pt-4 border-t border-slate-100">
                    {isRecording ? (
                      <button
                        type="button"
                        onClick={stopMicRecording}
                        className="w-full py-3 bg-red-600 hover:bg-red-700 text-white font-black text-xs uppercase tracking-wider rounded-xl transition-all shadow-md shadow-red-600/10 flex items-center justify-center gap-1.5"
                      >
                        <Square className="w-4 h-4 fill-current" />
                        Stop and Save Announcement
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={startMicRecording}
                        className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs uppercase tracking-wider rounded-xl transition-all shadow-md shadow-indigo-600/15 flex items-center justify-center gap-1.5"
                      >
                        <Play className="w-4 h-4 fill-current" />
                        Start Voice Recording
                      </button>
                    )}
                  </div>
                </div>

                {/* 2. File Uploader */}
                <div className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 shadow-sm space-y-4 flex flex-col justify-between">
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
                      <Upload className="text-indigo-600 w-4.5 h-4.5" />
                      <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider">Upload Pre-recorded File</h4>
                    </div>

                    <p className="text-xs text-slate-500 font-semibold leading-relaxed">
                      Don't want to record right now? Select an existing audio chime (MP3, WAV, OGG, or M4A format) from your local computer storage instead.
                    </p>

                    <div className="border-2 border-dashed border-slate-200 hover:border-indigo-400 rounded-xl p-6 transition-all text-center relative group">
                      <input
                        type="file"
                        accept="audio/*"
                        onChange={handleAudioUpload}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                      />
                      <Upload className="w-8 h-8 text-slate-400 mx-auto mb-2 group-hover:text-indigo-600 transition-colors" />
                      <span className="text-xs font-extrabold text-slate-700 block mt-1 hover:text-indigo-600 transition-colors">
                        Choose Audio File
                      </span>
                      <span className="text-[10px] text-slate-400 mt-1 block">
                        Drag and drop files or browse (Max 8MB limit)
                      </span>
                    </div>

                    <div className="text-[10px] text-slate-500 leading-relaxed font-semibold bg-indigo-50/40 p-3 rounded-lg border border-indigo-100/40">
                      💡 <strong>Format Note:</strong> For maximum browser interoperability and loud audio transmission, standard MP3 or high quality WAV files are highly recommended.
                    </div>
                  </div>
                </div>
              </div>

              {/* 3. Audio Records List */}
              <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-6 shadow-sm space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <h4 className="text-xs font-black text-slate-900 uppercase tracking-widest flex items-center gap-2">
                    <Megaphone className="w-4 h-4 text-slate-600" />
                    Custom Recorded & Uploaded Libraries ({recordedAudios.length})
                  </h4>
                </div>

                {recordedAudios.length === 0 ? (
                  <div className="text-center py-10">
                    <History className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                    <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider">No voice announcements recorded yet</p>
                    <p className="text-[10px] text-slate-400 max-w-[280px] mx-auto mt-1">
                      Start recording above, or import a pre-recorded broadcast bell file to fill this dashboard space.
                    </p>
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {recordedAudios.map((item) => {
                      const isPreviewing = previewPlayingId === item.id;
                      return (
                        <div 
                          key={item.id}
                          className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-colors hover:bg-slate-50/30 px-1"
                        >
                          <div className="flex items-center gap-3">
                            <span className="p-2 bg-indigo-50 border border-indigo-100 rounded-lg text-indigo-700 shrink-0">
                              <Mic className="w-4 h-4" />
                            </span>
                            <div>
                              <h5 className="text-sm font-black text-slate-900 leading-snug">
                                {item.name}
                              </h5>
                              <p className="text-[10px] text-slate-400 font-semibold mt-0.5">
                                Created: {new Date(item.timestamp).toLocaleDateString()} {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
                            {/* Play Preview button */}
                            <button
                              type="button"
                              onClick={() => handlePreviewPlay(item)}
                              className={`p-1.5 px-3 text-xs font-extrabold rounded-lg border transition-all inline-flex items-center gap-1 ${
                                isPreviewing 
                                  ? 'bg-red-50 hover:bg-red-100 border-red-200 text-red-700 font-black' 
                                  : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-700'
                              }`}
                              title={isPreviewing ? "Stop Previewing Locally" : "Listen Preview Locally"}
                            >
                              {isPreviewing ? (
                                <>
                                  <Square className="w-3.5 h-3.5 fill-current" />
                                  Stop Preview
                                </>
                              ) : (
                                <>
                                  <Play className="w-3.5 h-3.5 fill-current" />
                                  Listen Preview
                                </>
                              )}
                            </button>

                            {/* Global Broadcast Broadcast Button */}
                            <button
                              type="button"
                              onClick={() => handleBroadcastRecordedAudio(item)}
                              className="p-1.5 px-3 bg-indigo-600 hover:bg-indigo-700 border border-transparent text-white text-xs font-black uppercase tracking-wider rounded-lg transition-all shadow-sm flex items-center gap-1"
                              title="Broadcast this recorded voice over all active teacher monitors & classroom intercom systems immediately"
                            >
                              <Megaphone className="w-3.5 h-3.5 fill-current" />
                              Broadcast Intercom
                            </button>

                            {/* Delete button */}
                            <button
                              type="button"
                              onClick={() => handleDeleteRecording(item.id, item.name)}
                              className="p-1.5 bg-slate-50 hover:bg-red-50 text-slate-400 hover:text-red-500 border border-slate-200 hover:border-red-200 rounded-lg transition-all"
                              title="Remove custom audio recording from system"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Right 1 col: Alarm Logs and Drills metadata */}
        <div className="space-y-6">
          
          {/* Quick Guide */}
          <div className="bg-gradient-to-br from-indigo-900 to-slate-900 text-white border-0 rounded-2xl p-6 shadow-md relative overflow-hidden">
            <div className="absolute right-0 bottom-0 opacity-15 transform translate-y-12 translate-x-4">
              <ShieldCheck className="w-48 h-48" />
            </div>
            
            <span className="text-[10px] font-black tracking-widest uppercase text-indigo-300">Operational Guide</span>
            <h3 className="text-lg font-black tracking-tight mt-1 mb-2">Campus Security Standard</h3>
            <p className="text-xs text-indigo-100 leading-relaxed font-semibold">
              Warning signals utilize highly-piercing acoustic frequencies built on pure synthesis. Perfect for broadcast over classroom speakers.
            </p>

            <ul className="mt-4 space-y-2.5 text-xs text-slate-300 font-medium">
              <li className="flex items-start gap-2">
                <span className="text-emerald-400 font-bold">✔</span>
                <span>Sirens run purely on dynamic hardware osc limits, requiring no internet connectivity to serve files.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-emerald-400 font-bold">✔</span>
                <span>Active states are broadcast instantly to other opened teacher desktop panels in real-time.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-emerald-400 font-bold">✔</span>
                <span>Use <strong>"All Clear"</strong> to cleanly reset lockdown warning stroboscopes safely.</span>
              </li>
            </ul>
          </div>

          {/* Alarm History Log */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-md font-black text-slate-950 uppercase tracking-wider flex items-center gap-2">
                <History className="w-5 h-5 text-indigo-600" />
                Trigger Logs
              </h3>
              {logs.length > 0 && (
                <button 
                  onClick={handleClearLogs}
                  className="p-1.5 text-slate-400 hover:text-red-500 rounded-lg transition-colors hover:bg-red-50 border border-transparent hover:border-red-100"
                  title="Clear Log History"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>

            {logs.length === 0 ? (
              <div className="text-center py-8 border-2 border-dashed border-slate-100 rounded-xl">
                <History className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider">No school warning logs</p>
                <p className="text-[10px] text-slate-400 mt-1">Alert events are captured here dynamically</p>
              </div>
            ) : (
              <div className="space-y-3 max-h-[320px] overflow-y-auto pr-1 no-scrollbar">
                {logs.map((log) => {
                  const alarmConfig = ALARM_TYPES.find(a => a.id === log.type);
                  const Icon = alarmConfig?.icon || AlertTriangle;
                  
                  return (
                    <div 
                      key={log.id}
                      className="p-3 bg-slate-50 border border-slate-200/80 rounded-xl space-y-2 hover:bg-slate-100/50 transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full ${
                          log.isDrill ? 'bg-indigo-50 text-indigo-600 border border-indigo-200' : 'bg-red-50 text-red-600 border border-red-200'
                        }`}>
                          {log.isDrill ? 'Drill Run' : 'Real Event'}
                        </span>
                        <div className="flex items-center gap-1 text-[10px] font-bold text-slate-400">
                          <Clock className="w-3.5 h-3.5" />
                          {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>

                      <div className="flex items-start gap-2">
                        <span className={`p-1.5 rounded-lg text-slate-800 ${getSeverityBadgeClass(alarmConfig?.severity || 'info')}`}>
                          <Icon className="w-3.5 h-3.5" />
                        </span>
                        <div className="space-y-0.5">
                          <h4 className="text-xs font-black text-slate-900">{log.label}</h4>
                          <p className="text-[10px] text-slate-500 font-semibold leading-relaxed">
                            "{log.customMsg}"
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 pt-1.5 border-t border-slate-200/50 mt-1">
                        <User className="w-3 h-3 text-slate-400" />
                        <span className="text-[9px] text-slate-500 font-semibold line-clamp-1">
                          Trigered by {log.triggeredBy} ({log.role})
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
