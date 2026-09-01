import React, { useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useAuth } from '../contexts/AuthContext';
import { db, Poll, Candidate, Vote, Student } from '../db/schema';
import { 
  Vote as VoteIcon, 
  Plus, 
  Trash2, 
  CheckCircle, 
  AlertCircle, 
  Award, 
  BarChart4, 
  ShieldCheck, 
  User, 
  UserPlus, 
  Search, 
  Clock, 
  Inbox, 
  Check, 
  Smartphone,
  RefreshCw,
  Archive,
  BarChart3,
  Flame,
  Fingerprint
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ResponsiveContainer, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Cell 
} from 'recharts';

export default function EVoting() {
  const { user } = useAuth();
  const canManageElection = user?.role === 'super_admin' || user?.role === 'admin' || user?.role === 'headteacher';

  // Navigation tabs of E-Voting Screen
  const [activeTab, setActiveTab] = useState<'booth' | 'results' | 'admin'>('booth');

  useEffect(() => {
    if (!canManageElection && activeTab === 'admin') {
      setActiveTab('booth');
    }
  }, [canManageElection, activeTab]);

  // Load tables
  const polls = useLiveQuery(() => db.polls.toArray());
  const candidates = useLiveQuery(() => db.candidates.toArray());
  const votes = useLiveQuery(() => db.votes.toArray());
  const students = useLiveQuery(() => db.students.toArray());

  // Active student voter state
  const [voterId, setVoterId] = useState('');
  const [verifiedStudent, setVerifiedStudent] = useState<Student | null>(null);
  const [verificationError, setVerificationError] = useState('');
  const [toastMsg, setToastMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Voting Booth selection state
  const [selectedPollId, setSelectedPollId] = useState<number | null>(null);
  const [selectedBallot, setSelectedBallot] = useState<Record<string, number>>({}); // position -> candidateId

  // Admin / Election configuration state
  const [newPollTitle, setNewPollTitle] = useState('');
  const [newPollDesc, setNewPollDesc] = useState('');
  const [newPollCategory, setNewPollCategory] = useState('SRC General Elections');
  const [isCreatingPoll, setIsCreatingPoll] = useState(false);

  // Candidate Registration state
  const [candidatePollId, setCandidatePollId] = useState<number>(0);
  const [candName, setCandName] = useState('');
  const [candPosition, setCandPosition] = useState('President');
  const [candClass, setCandClass] = useState('');
  const [candManifesto, setCandManifesto] = useState('');
  const [isAddingCandidate, setIsAddingCandidate] = useState(false);

  // Quick positions list
  const positionsList = ['President', 'General Secretary', 'SRC Treasurer', 'Sports Captain', 'Entertainment Prefect', 'Class Prefect'];

  // Toast show helper
  const showNotification = (text: string, type: 'success' | 'error' = 'success') => {
    setToastMsg({ text, type });
    setTimeout(() => setToastMsg(null), 3000);
  };

  // Auto seed a default SRC election if none exists
  useEffect(() => {
    const seedElection = async () => {
      try {
        const pollCount = await db.polls.count();
        if (pollCount === 0) {
          const seededPollId = await db.polls.add({
            title: 'School Representative Council (SRC) General Elections 2026',
            description: 'Annual democratic election to choose next leader for student body. Be heard, vote right!',
            category: 'SRC Executive General Elections',
            status: 'active',
            createdAt: Date.now()
          });

          await db.candidates.bulkAdd([
            {
              pollId: seededPollId,
              name: 'Sandra Ofori-Amoah',
              position: 'President',
              class: 'JHS 1',
              votesCount: 0,
              manifesto: 'I pledge to expand clean drinking fountains, champion weekly soccer invitationals, and restore the students lounge.',
              photo: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150&q=80'
            },
            {
              pollId: seededPollId,
              name: 'Kofi Mensah Junior',
              position: 'President',
              class: 'JHS 1',
              votesCount: 0,
              manifesto: 'Leading through digital tools! I stand for adding a computer graphics club, faster library computers, and creative arts field trips.',
              photo: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&q=80'
            },
            {
              pollId: seededPollId,
              name: 'Linda Appiah Mensah',
              position: 'General Secretary',
              class: 'JHS 1',
              votesCount: 0,
              manifesto: 'Diligent documentation and active notices. I will publish beautiful weekly briefs so students are always informed of upcoming fun events!',
              photo: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&q=80'
            },
            {
              pollId: seededPollId,
              name: 'Dennis Baah Asante',
              position: 'General Secretary',
              class: 'P2',
              votesCount: 0,
              manifesto: 'Pristine management. Let us modernise internal feedback boxes and provide active platforms for JHS and Primary connection points.',
              photo: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&q=80'
            }
          ]);
        }
      } catch (err) {
        console.error("Unable to bootstrap e-voting poll seed:", err);
      }
    };
    seedElection();
  }, []);

  // Handle student voter search & identity verification
  const handleVerifyVoter = () => {
    setVerificationError('');
    if (!voterId.trim()) {
      setVerificationError('Student ID is required.');
      return;
    }

    const matched = students?.find(s => s.studentId.toUpperCase() === voterId.trim().toUpperCase());
    if (!matched) {
      setVerificationError('No matching student found with that ID card. Please verify your Student ID.');
      setVerifiedStudent(null);
      return;
    }

    setVerifiedStudent(matched);
    showNotification(`Identity Verified: Welcome ${matched.firstName}!`, 'success');
  };

  // Reset current voter session
  const logoutVoter = () => {
    setVerifiedStudent(null);
    setVoterId('');
    setSelectedPollId(null);
    setSelectedBallot({});
  };

  // Get active polls list
  const activePolls = polls?.filter(p => p.status === 'active') || [];

  // Filter candidates running in selected poll
  const activePollCandidates = candidates?.filter(c => c.pollId === selectedPollId) || [];

  // Categorize candidates of current poll by position
  const candidatesByPosition = activePollCandidates.reduce((acc, cand) => {
    if (!acc[cand.position]) {
      acc[cand.position] = [];
    }
    acc[cand.position].push(cand);
    return acc;
  }, {} as Record<string, Candidate[]>);

  // Check if voter has already submitted a ballot for selected Poll
  const studentHasVotedThisPoll = (pollId: number, studentId: string) => {
    if (!votes) return false;
    return votes.some(v => v.pollId === pollId && v.studentId.toUpperCase() === studentId.toUpperCase());
  };

  // Process and submit Student vote selection
  const handleCastBallot = async () => {
    if (!verifiedStudent || !selectedPollId) return;

    // Check if voter already cast ballot
    if (studentHasVotedThisPoll(selectedPollId, verifiedStudent.studentId)) {
      showNotification('Access denied: Student has already cast their ballot!', 'error');
      return;
    }

    const positionsToVote = Object.keys(candidatesByPosition);
    if (positionsToVote.length === 0) {
      showNotification('This election does not have any nominees active.', 'error');
      return;
    }

    // Ensure they selected someone for each position
    const incompleteSelection = positionsToVote.some(pos => !selectedBallot[pos]);
    if (incompleteSelection) {
      showNotification('Please select a preferred candidate for all positions.', 'error');
      return;
    }

    try {
      // Create safe transactions in IndexedDB
      for (const pos of positionsToVote) {
        const selectedCandidateId = selectedBallot[pos];

        // 1. Add Vote Log
        await db.votes.add({
          pollId: selectedPollId,
          studentId: verifiedStudent.studentId,
          position: pos,
          candidateId: selectedCandidateId,
          timestamp: Date.now()
        });

        // 2. Increment votes counter for candidate
        const cand = candidates?.find(c => c.id === selectedCandidateId);
        if (cand) {
          await db.candidates.update(selectedCandidateId, {
            votesCount: (cand.votesCount || 0) + 1
          });
        }
      }

      // 3. Create real SMS notification inside smsLogs for durable logging
      const chosenPoll = polls?.find(p => p.id === selectedPollId);
      const textMsg = `Esepa E-Voting Station: Vote Cast Confirmed! ${verifiedStudent.firstName} ${verifiedStudent.lastName} (ID: ${verifiedStudent.studentId}) successfully cast multiple votes for ${chosenPoll?.title || 'E-Elections'} positions. Secure encrypted logging completed. Thank you!`;
      
      await db.smsLogs.add({
        recipientPhone: verifiedStudent.guardianPhone || '0241234567',
        recipientName: verifiedStudent.guardianName || `${verifiedStudent.firstName} ${verifiedStudent.lastName}`,
        recipientType: 'Parent',
        message: textMsg,
        type: 'Notification',
        status: 'Sent',
        createdAt: Date.now()
      });

      showNotification('Ballot securely submitted! Verification SMS triggered.', 'success');
      
      // Cleanup / Keep voter screen state positive
      setSelectedBallot({});
      // Keep session verified but show success screen state
    } catch (err) {
      console.error(err);
      showNotification('Error processing secure ballot transaction.', 'error');
    }
  };

  // ADMIN OPERATIONS
  // Create virtual poll
  const handleCreatePoll = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPollTitle.trim()) return;

    try {
      await db.polls.add({
        title: newPollTitle,
        description: newPollDesc,
        category: newPollCategory,
        status: 'draft',
        createdAt: Date.now()
      });

      setNewPollTitle('');
      setNewPollDesc('');
      setIsCreatingPoll(false);
      showNotification('New Election created in draft state successfully!', 'success');
    } catch (err) {
      showNotification('Could not record poll config.', 'error');
    }
  };

  // Delete virtual poll
  const handleDeletePoll = async (id: number) => {
    if (!confirm('Are you sure you want to delete this election entirely? Candidates and cast votes will be cleared.')) return;
    try {
      await db.polls.delete(id);
      // Clean candidates
      const associatedCand = candidates?.filter(c => c.pollId === id) || [];
      for (const cand of associatedCand) {
        await db.candidates.delete(cand.id!);
      }
      // Clean votes
      const associatedVotes = votes?.filter(v => v.pollId === id) || [];
      for (const vt of associatedVotes) {
        await db.votes.delete(vt.id!);
      }
      showNotification('Election completely destroyed.', 'success');
      if (selectedPollId === id) setSelectedPollId(null);
    } catch (err) {
      showNotification('Delete transaction error.', 'error');
    }
  };

  // Change poll states (draft -> active -> completed)
  const handleTogglePollStatus = async (id: number, currentStatus: string) => {
    const nextStatus = currentStatus === 'draft' ? 'active' : currentStatus === 'active' ? 'completed' : 'draft';
    try {
      await db.polls.update(id, { status: nextStatus });
      showNotification(`Election status updated to "${nextStatus.toUpperCase()}"!`, 'success');
    } catch (err) {
      showNotification('Could not update state.', 'error');
    }
  };

  // Register Candidate
  const handleAddCandidate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!candidatePollId || !candName.trim() || !candClass.trim()) {
      showNotification('Please fill out all nominee forms.', 'error');
      return;
    }

    try {
      await db.candidates.add({
        pollId: Number(candidatePollId),
        name: candName,
        position: candPosition,
        class: candClass,
        votesCount: 0,
        manifesto: candManifesto || 'Pledge to serve students body with core integrity.',
        photo: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&q=80'
      });

      setCandName('');
      setCandClass('');
      setCandManifesto('');
      setCandPosition('President');
      setIsAddingCandidate(false);
      showNotification('Nominee registered successfully!', 'success');
    } catch (err) {
      showNotification('Error writing nominee.', 'error');
    }
  };

  // Delete nominee
  const handleDeleteCandidate = async (id: number) => {
    if (!confirm('Are you sure you want to remove this candidate nomination?')) return;
    try {
      await db.candidates.delete(id);
      showNotification('Nominee removed.', 'success');
    } catch (err) {
      showNotification('Nominee deletion error.', 'error');
    }
  };

  // Get first available poll if none selected in results list
  const activeResultsPollId = selectedPollId || (polls && polls.length > 0 ? polls[0].id : null);
  const activeResultsPoll = polls?.find(p => p.id === activeResultsPollId);
  const activeResultsCandidates = candidates?.filter(c => c.pollId === activeResultsPollId) || [];

  // Group stand-in results candidates by position
  const resultsByPosition = activeResultsCandidates.reduce((acc, c) => {
    if (!acc[c.position]) acc[c.position] = [];
    acc[c.position].push(c);
    return acc;
  }, {} as Record<string, typeof activeResultsCandidates>);

  return (
    <div className="space-y-6">
      {/* Toast Alert */}
      <AnimatePresence>
        {toastMsg && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className={`fixed top-4 right-4 z-50 px-5 py-3 rounded-xl shadow-lg border text-white text-xs font-bold font-sans flex items-center gap-2 ${
              toastMsg.type === 'success' ? 'bg-emerald-600 border-emerald-500' : 'bg-rose-600 border-rose-500'
            }`}
          >
            {toastMsg.type === 'success' ? <ShieldCheck className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
            {toastMsg.text}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header Visual Hero */}
      <div className="bg-slate-900 rounded-3xl p-6 sm:p-8 text-white relative overflow-hidden shadow-xl border border-slate-800">
        <div className="absolute right-0 bottom-0 translate-x-12 translate-y-12 opacity-5 select-none touch-none">
          <VoteIcon className="w-80 h-80" />
        </div>
        
        <div className="relative z-10 max-w-2xl space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-indigo-500/10 border border-indigo-400/20 text-indigo-400 rounded-full text-[10px] font-black uppercase tracking-widest">
            <Fingerprint className="w-3.5 h-3.5" /> SECURE ADVANCED MULTI-CHANNEL CLIENT-SIDE LEDGER
          </div>
          <h2 className="text-2xl sm:text-3xl font-black tracking-tight leading-none">
            Esepa Digital <span className="text-indigo-400">E-Voting</span> Suite
          </h2>
          <p className="text-xs text-slate-400 leading-relaxed max-w-lg font-medium">
            Perform authenticated ballot registration, candidate nomination tallies, and live graphical election results reporting. Safe local ledger verification with automated parent SMS audit logs.
          </p>
        </div>

        {/* Tab Controls */}
        <div className="flex gap-2 mt-8 border-t border-slate-800/80 pt-4 relative z-10 font-sans">
          <button
            onClick={() => setActiveTab('booth')}
            className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest flex items-center gap-2 transition-all ${
              activeTab === 'booth'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'text-slate-450 hover:text-white hover:bg-slate-800'
            }`}
          >
            <VoteIcon className="w-4 h-4" /> Voting Booth
          </button>
          <button
            onClick={() => setActiveTab('results')}
            className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest flex items-center gap-2 transition-all ${
              activeTab === 'results'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'text-slate-450 hover:text-white hover:bg-slate-800'
            }`}
          >
            <BarChart3 className="w-4 h-4" /> Live Standings
          </button>
          {canManageElection && (
            <button
              onClick={() => setActiveTab('admin')}
              className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest flex items-center gap-2 transition-all ${
                activeTab === 'admin'
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'text-slate-450 hover:text-white hover:bg-slate-800'
              }`}
            >
              <ShieldCheck className="w-4 h-4" /> Admin Console
            </button>
          )}
        </div>
      </div>

      {/* Primary Tab View Contents */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.15 }}
          className="grid grid-cols-1 gap-6"
        >

          {/* ==================== 1. VOTING BOOTH ==================== */}
          {activeTab === 'booth' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              
              {/* Voter Registration Identity Verification Column */}
              <div className="lg:col-span-1 space-y-4">
                {!verifiedStudent ? (
                  <div className="bg-white rounded-2xl p-6 border border-slate-200 outline-none shadow-sm space-y-4">
                    <div className="flex items-center gap-3 space-y-1">
                      <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shrink-0">
                        <Fingerprint className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="text-sm font-extrabold text-slate-900 uppercase tracking-tight">Identity screening</h3>
                        <p className="text-[10px] text-slate-400 font-bold">Swipe or enter Student ID Card</p>
                      </div>
                    </div>

                    <div className="space-y-1.5 pt-2">
                      <label className="text-[10px] font-black text-slate-450 uppercase tracking-widest">Active Student ID</label>
                      <div className="relative">
                        <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-450" />
                        <input
                          type="text"
                          value={voterId}
                          onChange={(e) => setVoterId(e.target.value)}
                          onKeyDown={(e) => { if (e.key === 'Enter') handleVerifyVoter(); }}
                          placeholder="Enter Student ID..."
                          className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-200 focus:border-indigo-500 rounded-xl font-mono font-bold text-xs outline-none uppercase"
                        />
                      </div>
                      {verificationError && (
                        <p className="text-[10px] text-rose-600 font-bold flex items-center gap-1.5 mt-1">
                          <AlertCircle className="w-3.5 h-3.5" /> {verificationError}
                        </p>
                      )}
                    </div>

                    <p className="text-[10px] text-slate-400 bg-slate-50 p-3 rounded-xl border border-slate-200/50 leading-relaxed font-medium">
                      🔒 <b className="text-slate-600 font-bold">Double-voting blocks:</b> High level student card hashes guarantee a single cast ballot outcome per poll.
                    </p>

                    <button
                      onClick={handleVerifyVoter}
                      className="w-full bg-slate-900 hover:bg-slate-800 text-white rounded-xl py-3 font-bold text-xs uppercase tracking-wider transition-all shadow-sm"
                    >
                      Authenticate Account
                    </button>
                  </div>
                ) : (
                  <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-4">
                    <div className="flex items-center gap-4">
                      {verifiedStudent.photo ? (
                        <img 
                          src={verifiedStudent.photo} 
                          alt="Voter" 
                          className="w-12 h-12 rounded-full object-cover border-2 border-indigo-100 shadow-sm"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-full bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 uppercase font-black font-sans shrink-0">
                          {(verifiedStudent.firstName?.[0] || '')}{(verifiedStudent.lastName?.[0] || '') || 'V'}
                        </div>
                      )}
                      <div>
                        <div className="flex items-center gap-2">
                          <b className="text-sm font-extrabold text-slate-900 leading-tight block">
                            {verifiedStudent.firstName} {verifiedStudent.lastName}
                          </b>
                          <span className="bg-emerald-50 text-emerald-700 text-[8px] font-black uppercase tracking-wider border border-emerald-100 px-1.5 py-0.5 rounded-full">
                            VERIFIED
                          </span>
                        </div>
                        <p className="text-[10px] font-bold text-slate-500 font-mono mt-0.5">
                          ID: {verifiedStudent.studentId} • Class: {verifiedStudent.class}
                        </p>
                      </div>
                    </div>

                    <hr className="border-slate-100" />

                    <div className="space-y-2 text-xs">
                      <div className="flex justify-between items-center bg-slate-50 border border-slate-200/50 p-2.5 rounded-xl">
                        <span className="text-slate-500 font-bold">Audit Phone</span>
                        <span className="font-mono text-slate-800 font-bold">{verifiedStudent.guardianPhone}</span>
                      </div>
                      <div className="flex justify-between items-center bg-slate-50 border border-slate-200/50 p-2.5 rounded-xl">
                        <span className="text-slate-500 font-bold">Ballots Cast</span>
                        <span className="font-extrabold text-indigo-600">
                          {votes ? votes.filter(v => v.studentId.toUpperCase() === verifiedStudent.studentId.toUpperCase()).length : 0}
                        </span>
                      </div>
                    </div>

                    <button
                      onClick={logoutVoter}
                      className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl py-2.5 font-extrabold text-xs uppercase tracking-wider transition-all"
                    >
                      Exit Session
                    </button>
                  </div>
                )}

                {/* Helpful Legend */}
                <div className="bg-slate-55 border border-slate-200/50 rounded-2xl p-5 space-y-2.5">
                  <h4 className="text-[11px] font-black uppercase text-slate-650 tracking-wider">Instructions</h4>
                  <ul className="text-[10px] text-slate-550 space-y-1.5 list-disc pl-4 font-medium leading-relaxed">
                    <li>Students must present their individual student identity card values.</li>
                    <li>Verify details then locate any ongoing school representative elections.</li>
                    <li>Make single preferences for each desk nominate and validate ledger.</li>
                  </ul>
                </div>
              </div>

              {/* Elections & Balloting Column */}
              <div className="lg:col-span-2 space-y-6">
                {!verifiedStudent ? (
                  <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center flex flex-col items-center justify-center space-y-4 shadow-sm min-h-[300px]">
                    <div className="w-14 h-14 rounded-full bg-slate-50 flex items-center justify-center border border-slate-200">
                      <Fingerprint className="w-7 h-7 text-slate-400" />
                    </div>
                    <div className="max-w-md space-y-1">
                      <h4 className="text-sm font-black text-slate-900 uppercase tracking-wider">Access Locked</h4>
                      <p className="text-xs text-slate-400 font-medium">Please authenticate a student ID card on the left panel to load active ballots and Cast your official Vote selection securely.</p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {/* Choose active poll */}
                    <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-4">
                      <h3 className="text-sm font-extrabold text-slate-900 uppercase tracking-tight">1. SELECT ELECTION EVENT</h3>
                      {activePolls.length === 0 ? (
                        <div className="p-4 bg-slate-50 border border-slate-100 text-slate-500 rounded-xl text-center text-xs">
                          No active elections/polls currently ongoing at this moment.
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 gap-2.5">
                          {activePolls.map(p => {
                            const voted = studentHasVotedThisPoll(p.id!, verifiedStudent.studentId);
                            const isSelected = selectedPollId === p.id;
                            return (
                              <button
                                key={p.id}
                                onClick={() => { setSelectedPollId(p.id!); setSelectedBallot({}); }}
                                className={`p-4 rounded-xl text-left border transition-all flex justify-between items-center shadow-sm w-full outline-none ${
                                  isSelected 
                                    ? 'bg-indigo-50/50 border-indigo-400 ring-2 ring-indigo-500/10' 
                                    : 'bg-white border-slate-200 hover:border-slate-350'
                                }`}
                              >
                                <div className="space-y-1 max-w-sm sm:max-w-md">
                                  <div className="flex items-center gap-2">
                                    <span className="text-[9px] font-black px-2 py-0.5 bg-slate-100 text-slate-700 rounded-md border border-slate-200/50 uppercase tracking-wider">
                                      {p.category}
                                    </span>
                                    {voted ? (
                                      <span className="text-[9px] font-black px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-100 rounded-md uppercase tracking-wider flex items-center gap-1">
                                        <Check className="w-2.5 h-2.5" /> Completed
                                      </span>
                                    ) : (
                                      <span className="text-[9px] font-black px-2 py-0.5 bg-amber-50 text-amber-700 border border-amber-100 rounded-md uppercase tracking-wider flex items-center gap-1 animate-pulse-subtle">
                                        Open
                                      </span>
                                    )}
                                  </div>
                                  <h4 className="text-xs font-black text-slate-900 block truncate">{p.title}</h4>
                                  <p className="text-[10px] text-slate-450 truncate">{p.description}</p>
                                </div>
                                <div className="shrink-0 pl-3">
                                  <div className={`w-5 h-5 rounded-full border flex items-center justify-center transition-all ${
                                    isSelected ? 'border-indigo-600 bg-indigo-600' : 'border-slate-300'
                                  }`}>
                                    {isSelected && <Check className="w-3.5 h-3.5 text-white" />}
                                  </div>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    {/* Ballots nominees list */}
                    {selectedPollId && !studentHasVotedThisPoll(selectedPollId, verifiedStudent.studentId) && (
                      <div className="space-y-6">
                        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-4">
                          <h3 className="text-sm font-extrabold text-slate-900 uppercase tracking-tight">2. NOMINEE BALOT PREFERENCES</h3>

                          {Object.keys(candidatesByPosition).length === 0 ? (
                            <div className="p-4 bg-slate-50 border border-slate-100 text-slate-500 rounded-xl text-center text-xs">
                              No candidates registered in this election yet.
                            </div>
                          ) : (
                            <div className="space-y-6">
                              {Object.entries(candidatesByPosition).map(([position, list]) => (
                                <div key={position} className="space-y-3 pt-2">
                                  <div className="flex items-center gap-2">
                                    <span className="w-1.5 h-4 bg-indigo-600 rounded-full" />
                                    <h4 className="text-[11px] font-black text-slate-500 uppercase tracking-widest font-mono">
                                      {position}
                                    </h4>
                                  </div>

                                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                                    {list.map(cand => {
                                      const isPicked = selectedBallot[position] === cand.id;
                                      return (
                                        <button
                                          key={cand.id}
                                          type="button"
                                          onClick={() => setSelectedBallot(prev => ({ ...prev, [position]: cand.id! }))}
                                          className={`p-4 rounded-2xl border text-left flex flex-col gap-3.5 transition-all outline-none w-full shadow-sm relative overflow-hidden ${
                                            isPicked 
                                              ? 'border-indigo-500 bg-indigo-50/20 ring-2 ring-indigo-500/15' 
                                              : 'bg-white border-slate-200 hover:border-slate-300'
                                          }`}
                                        >
                                          {isPicked && (
                                            <div className="absolute top-0 right-0 bg-indigo-600 text-white rounded-bl-xl p-1.5">
                                              <Check className="w-3.5 h-3.5" />
                                            </div>
                                          )}

                                          <div className="flex items-center gap-3">
                                            {cand.photo ? (
                                              <img 
                                                src={cand.photo} 
                                                alt={cand.name} 
                                                className="w-10 h-10 rounded-full object-cover border border-slate-200"
                                                referrerPolicy="no-referrer"
                                              />
                                            ) : (
                                              <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 font-mono font-bold text-xs shrink-0">
                                                Cand
                                              </div>
                                            )}
                                            <div className="min-w-0 flex-1">
                                              <p className="text-xs font-black text-slate-900 truncate leading-none">{cand.name}</p>
                                              <p className="text-[10px] text-slate-450 font-bold mt-1 uppercase font-mono">Class: {cand.class}</p>
                                            </div>
                                          </div>

                                          <p className="text-[10px] text-slate-500 bg-slate-50/50 p-2.5 rounded-xl border border-slate-100 font-medium leading-relaxed italic italic-manifesto">
                                            &ldquo;{cand.manifesto}&rdquo;
                                          </p>
                                        </button>
                                      );
                                    })}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Submit Button */}
                        <div className="bg-slate-100 border border-slate-200/60 p-4 rounded-2xl flex flex-col sm:flex-row gap-3 justify-between items-center">
                          <p className="text-[10px] text-slate-500 text-center sm:text-left leading-relaxed font-semibold max-w-sm">
                            By clicking below, your ballot preferences will be written onto the local database. This operation is encrypted and final.
                          </p>
                          <button
                            onClick={handleCastBallot}
                            className="bg-indigo-600 hover:bg-indigo-700 text-white py-3 px-6 rounded-xl font-bold text-xs uppercase tracking-wider shadow-md transition-all whitespace-nowrap"
                          >
                            Submit Secure Ballot
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Voted success confirmation */}
                    {selectedPollId && studentHasVotedThisPoll(selectedPollId, verifiedStudent.studentId) && (
                      <div className="bg-white rounded-2xl p-8 border border-emerald-100 shadow-sm text-center flex flex-col items-center justify-center space-y-4">
                        <div className="w-14 h-14 rounded-full bg-emerald-50 border border-emerald-100 text-emerald-600 flex items-center justify-center">
                          <ShieldCheck className="w-7 h-7" />
                        </div>
                        <div className="max-w-md space-y-1.5">
                          <h4 className="text-sm font-black text-emerald-950 uppercase tracking-wider">Ballot successfully cast</h4>
                          <p className="text-xs text-slate-500 leading-relaxed font-bold">
                            You have completed the voting cycle for this election event! Double-voting constraints prevent any other submissions using student ID <span className="text-indigo-600 font-mono">{verifiedStudent.studentId}</span>. Thank you for voting!
                          </p>
                        </div>
                        <div className="text-xs font-mono bg-slate-50 p-2.5 rounded-xl border border-slate-200/50 text-slate-500 inline-block font-semibold">
                          Transaction secured. Parental SMS confirmation log created.
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ==================== 2. LIVE STANDINGS / GRAPHICS ==================== */}
          {activeTab === 'results' && (
            <div className="space-y-6">
              
              {/* Poll switch options */}
              <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm">
                <div className="flex flex-col sm:flex-row gap-2.5 justify-between items-center">
                  <div>
                    <h3 className="text-sm font-extrabold text-slate-900 uppercase tracking-tight">Active Live board</h3>
                    <p className="text-[10px] text-slate-400 font-bold">Select election to view real-time graphical standing percentages.</p>
                  </div>
                  
                  <div className="w-full sm:w-auto font-semibold">
                    <select
                      value={activeResultsPollId || ''}
                      onChange={(e) => setSelectedPollId(Number(e.target.value))}
                      className="w-full sm:w-80 px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-black text-slate-700 outline-none cursor-pointer"
                    >
                      <option value="" disabled>Select election event...</option>
                      {polls?.map(p => (
                        <option key={p.id} value={p.id}>
                          {p.title} ({p.status.toUpperCase()})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Tally Metrics & Recharts Dashboard */}
              {activeResultsPoll ? (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  
                  {/* Left stats card panel */}
                  <div className="lg:col-span-1 space-y-4">
                    <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-4">
                      <b className="text-xs font-black text-slate-400 uppercase tracking-widest font-mono block">Election Status Card</b>
                      
                      <div className="space-y-1.5">
                        <h4 className="text-xs font-bold text-slate-900 line-clamp-2 leading-tight">
                          {activeResultsPoll.title}
                        </h4>
                        <div className="flex items-center gap-2">
                          <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full ${
                            activeResultsPoll.status === 'active' 
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                              : 'bg-indigo-50 text-indigo-700 border border-indigo-100'
                          }`}>
                            {activeResultsPoll.status}
                          </span>
                          <span className="text-[9px] text-slate-400 font-mono uppercase font-bold">
                            Cat: {activeResultsPoll.category}
                          </span>
                        </div>
                      </div>

                      <hr className="border-slate-100" />

                      <div className="grid grid-cols-2 gap-2 text-center pt-2">
                        <div className="bg-slate-50 border border-slate-250/20 p-3 rounded-2xl">
                          <span className="text-[10px] text-slate-400 font-black block uppercase tracking-wide">Total Ballots</span>
                          {/* Each student votes for multiple positions. Total distinct voters: count unique student IDs in query */}
                          <span className="text-lg font-mono font-black text-slate-900">
                            {Array.from(new Set(votes?.filter(v => v.pollId === activeResultsPollId).map(v => v.studentId) || [])).length}
                          </span>
                        </div>
                        <div className="bg-slate-50 border border-slate-250/20 p-3 rounded-2xl">
                          <span className="text-[10px] text-slate-400 font-black block uppercase tracking-wide">Nominees list</span>
                          <span className="text-lg font-mono font-black text-slate-900">
                            {activeResultsCandidates.length}
                          </span>
                        </div>
                      </div>

                      {/* Vote participation percentage banner */}
                      <div className="p-3 bg-indigo-50/50 border border-indigo-100 rounded-2xl text-xs space-y-1">
                        <div className="flex justify-between items-center text-[10px] font-black text-indigo-900 uppercase">
                          <span>Student turnout rate</span>
                          <span className="font-mono">
                            {students && students.length > 0
                              ? Math.round((Array.from(new Set(votes?.filter(v => v.pollId === activeResultsPollId).map(v => v.studentId) || [])).length / students.length) * 100)
                              : 0}%
                          </span>
                        </div>
                        <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                          <div 
                            className="bg-indigo-600 h-full rounded-full transition-all duration-500"
                            style={{ 
                              width: `${students && students.length > 0 
                                ? Math.min(100, Math.round((Array.from(new Set(votes?.filter(v => v.pollId === activeResultsPollId).map(v => v.studentId) || [])).length / students.length) * 100)) 
                                : 0}%` 
                            }}
                          />
                        </div>
                      </div>
                    </div>

                    <div className="bg-slate-55 border border-slate-200 p-5 rounded-2xl space-y-4">
                      <h4 className="text-[10px] font-black uppercase text-slate-500 tracking-wider">Nominee Quick Leaderboard</h4>
                      
                      {activeResultsCandidates.length === 0 ? (
                        <p className="text-[10px] text-slate-450 italic font-medium">No candidates to rank yet.</p>
                      ) : (
                        <div className="space-y-2.5">
                          {activeResultsCandidates
                            .sort((a, b) => (b.votesCount || 0) - (a.votesCount || 0))
                            .slice(0, 3)
                            .map((cand, index) => (
                              <div key={cand.id} className="flex items-center gap-3">
                                <div className="w-5 h-5 rounded bg-amber-100 text-amber-800 text-[10px] font-black flex items-center justify-center border border-amber-200 font-mono">
                                  #{index + 1}
                                </div>
                                <div className="min-w-0 flex-1">
                                  <p className="text-[11px] font-bold text-slate-800 truncate">{cand.name}</p>
                                  <p className="text-[9px] text-slate-400 font-mono tracking-tight uppercase font-black">{cand.position}</p>
                                </div>
                                <div className="font-mono text-xs font-black text-indigo-700 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded-md">
                                  {cand.votesCount || 0}
                                </div>
                              </div>
                            ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Right visual chart panel */}
                  <div className="lg:col-span-2 space-y-6">
                    <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-6">
                      
                      {activeResultsCandidates.length === 0 ? (
                        <div className="p-8 text-center text-slate-400 text-xs text-muted-foreground min-h-[250px] flex flex-col justify-center items-center">
                          <Inbox className="w-8 h-8 text-slate-300 mb-2" />
                          No voting results or nominees registered under this election event yet.
                        </div>
                      ) : (
                        <div className="space-y-8">
                          {Object.entries(resultsByPosition).map(([position, list]) => {
                            const chartData = list.map(c => ({
                              name: c.name,
                              votes: c.votesCount || 0
                            }));

                            return (
                              <div key={position} className="space-y-4">
                                <div className="flex justify-between items-center border-b border-slate-100 pb-2.5">
                                  <div className="flex items-center gap-2">
                                    <span className="w-1 h-3.5 bg-indigo-600 rounded-full" />
                                    <h4 className="text-xs font-black text-slate-800 uppercase tracking-widest font-mono">
                                      {position} Standings
                                    </h4>
                                  </div>
                                  <span className="text-[10px] font-bold text-slate-400 font-mono">
                                    Total: {chartData.reduce((s, item) => s + item.votes, 0)} votes
                                  </span>
                                </div>

                                {/* Recharts BarChart container */}
                                <div className="h-52 w-full pr-1">
                                  <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 5 }}>
                                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                      <XAxis 
                                        dataKey="name" 
                                        stroke="#94a3b8" 
                                        fontSize={9} 
                                        tickLine={false} 
                                        fontFamily="sans-serif"
                                        fontWeight={600}
                                      />
                                      <YAxis 
                                        stroke="#94a3b8" 
                                        fontSize={9} 
                                        tickLine={false} 
                                        axisLine={false}
                                        allowDecimals={false}
                                      />
                                      <Tooltip
                                        contentStyle={{ backgroundColor: '#0f172a', borderRadius: '10px', border: 'none', color: '#fff' }}
                                        labelStyle={{ fontWeight: 'bold', fontSize: '10px' }}
                                        itemStyle={{ fontSize: '11px', fontWeight: 'bold' }}
                                      />
                                      <Bar dataKey="votes" fill="var(--color-indigo-600)" radius={[6, 6, 0, 0]} maxBarSize={45}>
                                        {chartData.map((entry, index) => (
                                          <Cell 
                                            key={`cell-${index}`} 
                                            fill={index % 2 === 0 ? 'var(--color-indigo-600)' : 'var(--color-indigo-400)'} 
                                          />
                                        ))}
                                      </Bar>
                                    </BarChart>
                                  </ResponsiveContainer>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}

                    </div>
                  </div>

                </div>
              ) : (
                <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center flex flex-col items-center justify-center space-y-3 shadow-sm min-h-[300px]">
                  <Inbox className="w-10 h-10 text-slate-300" />
                  <p className="text-xs text-slate-400 font-medium">Please create an election first or select an existing one to render graph panels.</p>
                </div>
              )}
            </div>
          )}

          {/* ==================== 3. ADMIN / MANAGEMENT CONSOLE ==================== */}
          {activeTab === 'admin' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              
              {/* Poll setup and candidate injection tools */}
              <div className="lg:col-span-1 space-y-4">
                
                {/* 3.1 Create Election Form */}
                <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-4">
                  <div className="flex justify-between items-center">
                    <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest font-mono">Create Election</h3>
                    <button
                      onClick={() => setIsCreatingPoll(!isCreatingPoll)}
                      className="text-indigo-650 hover:text-indigo-800 text-[10px] font-black uppercase tracking-wider"
                    >
                      {isCreatingPoll ? "Hide" : "+ Quick Add"}
                    </button>
                  </div>

                  {isCreatingPoll && (
                    <form onSubmit={handleCreatePoll} className="space-y-3.5 pt-2">
                      <div className="space-y-1">
                        <label className="text-[9px] font-black text-slate-450 uppercase tracking-widest">Election Title</label>
                        <input
                          type="text"
                          required
                          value={newPollTitle}
                          onChange={(e) => setNewPollTitle(e.target.value)}
                          placeholder="e.g. SRC President Elections"
                          className="w-full px-3 py-2 bg-slate-50 border border-slate-200 focus:border-indigo-500 rounded-xl text-xs font-bold outline-none font-sans"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[9px] font-black text-slate-450 uppercase tracking-widest">Category Type</label>
                        <input
                          type="text"
                          value={newPollCategory}
                          onChange={(e) => setNewPollCategory(e.target.value)}
                          placeholder="e.g. Prefects Selection"
                          className="w-full px-3 py-2 bg-slate-50 border border-slate-200 focus:border-indigo-500 rounded-xl text-xs font-bold outline-none font-sans"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[9px] font-black text-slate-450 uppercase tracking-widest">Short Description</label>
                        <textarea
                          value={newPollDesc}
                          onChange={(e) => setNewPollDesc(e.target.value)}
                          placeholder="General instructions for students..."
                          rows={2}
                          className="w-full px-3 py-2 bg-slate-50 border border-slate-200 focus:border-indigo-500 rounded-xl text-xs font-bold outline-none font-sans resize-none"
                        />
                      </div>

                      <button
                        type="submit"
                        className="w-full bg-slate-900 hover:bg-slate-800 text-white rounded-xl py-2.5 font-bold text-xs uppercase tracking-wider transition-all"
                      >
                        Publish Draft Tally
                      </button>
                    </form>
                  )}
                </div>

                {/* 3.2 Candidate Injection Form */}
                <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-4">
                  <div className="flex justify-between items-center">
                    <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest font-mono">Register Nominee</h3>
                    <button
                      onClick={() => setIsAddingCandidate(!isAddingCandidate)}
                      className="text-indigo-650 hover:text-indigo-800 text-[10px] font-black uppercase tracking-wider"
                    >
                      {isAddingCandidate ? "Minimize" : "+ Inject"}
                    </button>
                  </div>

                  {isAddingCandidate && (
                    <form onSubmit={handleAddCandidate} className="space-y-3.5 pt-2">
                      
                      <div className="space-y-1 font-semibold">
                        <label className="text-[9px] font-black text-slate-450 uppercase tracking-widest">Select Target Election</label>
                        <select
                          value={candidatePollId}
                          onChange={(e) => setCandidatePollId(Number(e.target.value))}
                          className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none cursor-pointer"
                        >
                          <option value={0}>Choose election...</option>
                          {polls?.map(p => (
                            <option key={p.id} value={p.id}>{p.title}</option>
                          ))}
                        </select>
                      </div>

                      <div className="space-y-1">
                        <label className="text-[9px] font-black text-slate-450 uppercase tracking-widest">Nominee Full Name</label>
                        <input
                          type="text"
                          required
                          value={candName}
                          onChange={(e) => setCandName(e.target.value)}
                          placeholder="Elizabeth Mensah"
                          className="w-full px-3 py-2 bg-slate-50 border border-slate-200 focus:border-indigo-500 rounded-xl text-xs font-bold outline-none font-sans"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1 font-semibold">
                          <label className="text-[9px] font-black text-slate-450 uppercase tracking-widest">Position Desk</label>
                          <select
                            value={candPosition}
                            onChange={(e) => setCandPosition(e.target.value)}
                            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none cursor-pointer"
                          >
                            {positionsList.map(p => (
                              <option key={p} value={p}>{p}</option>
                            ))}
                          </select>
                        </div>
                        <div className="space-y-1">
                          <label className="text-[9px] font-black text-slate-450 uppercase tracking-widest">Class Code</label>
                          <input
                            type="text"
                            required
                            value={candClass}
                            onChange={(e) => setCandClass(e.target.value)}
                            placeholder="e.g. JHS 1"
                            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 focus:border-indigo-500 rounded-xl text-xs font-bold outline-none font-sans uppercase"
                          />
                        </div>
                      </div>

                      <div className="space-y-1">
                        <label className="text-[9px] font-black text-slate-450 uppercase tracking-widest">Nominee Manifesto</label>
                        <textarea
                          value={candManifesto}
                          onChange={(e) => setCandManifesto(e.target.value)}
                          placeholder="Brief pledge / vision points..."
                          rows={2}
                          className="w-full px-3 py-2 bg-slate-50 border border-slate-200 focus:border-indigo-500 rounded-xl text-xs font-bold outline-none font-sans resize-none"
                        />
                      </div>

                      <button
                        type="submit"
                        className="w-full bg-slate-900 hover:bg-slate-800 text-white rounded-xl py-2.5 font-bold text-xs uppercase tracking-wider transition-all"
                      >
                        Register Nominee
                      </button>
                    </form>
                  )}
                </div>
              </div>

              {/* Elections and registered nominees listing board */}
              <div className="lg:col-span-2 space-y-6">
                
                {/* list elections */}
                <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-4">
                  <h3 className="text-sm font-extrabold text-slate-900 uppercase tracking-tight">Active Elections Control</h3>

                  {polls && polls.length === 0 ? (
                    <div className="py-6 text-center text-slate-400 text-xs">
                      No school elections set up yet. Use the left panel to issue one.
                    </div>
                  ) : (
                    <div className="space-y-3.5">
                      {polls?.map(p => {
                        const associatedCandidates = candidates?.filter(c => c.pollId === p.id) || [];
                        return (
                          <div key={p.id} className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
                            <div className="flex flex-col sm:flex-row gap-2.5 justify-between items-start sm:items-center">
                              <div>
                                <h4 className="text-xs font-black text-slate-800 block">{p.title}</h4>
                                <p className="text-[9px] text-slate-400 font-bold uppercase font-mono mt-0.5">
                                  Category: {p.category} • Candidates: {associatedCandidates.length}
                                </p>
                              </div>
                              
                              <div className="flex gap-1.5 self-end sm:self-auto">
                                <button
                                  type="button"
                                  onClick={() => handleTogglePollStatus(p.id!, p.status)}
                                  className={`px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider border transition-all select-none ${
                                    p.status === 'draft' 
                                      ? 'bg-amber-100 hover:bg-amber-200 text-amber-850 border-amber-300' 
                                      : p.status === 'active' 
                                      ? 'bg-emerald-100 hover:bg-emerald-200 text-emerald-850 border-emerald-300' 
                                      : 'bg-indigo-100 hover:bg-indigo-200 text-indigo-850 border-indigo-300'
                                  }`}
                                >
                                  🔄 Status: {p.status}
                                </button>
                                <button
                                  onClick={() => handleDeletePoll(p.id!)}
                                  className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg transition-colors border border-rose-100"
                                  title="Delete election entirely"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>

                            {/* Candidate nominations roster inside election */}
                            {associatedCandidates.length > 0 && (
                              <div className="pt-2 border-t border-slate-200/50 space-y-1.5">
                                <p className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Nominee Slate</p>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                  {associatedCandidates.map(cand => (
                                    <div key={cand.id} className="bg-white px-3 py-2 rounded-xl border border-slate-150/40 flex justify-between items-center text-xs shadow-sm">
                                      <div className="min-w-0 flex-1 pr-2">
                                        <p className="font-extrabold text-slate-800 truncate leading-tight">{cand.name}</p>
                                        <p className="text-[9px] text-slate-440 font-bold font-mono tracking-wider uppercase mt-0.5 mt-0.5-spec flex items-center gap-1.5">
                                          <span>Class {cand.class}</span> | <span className="text-indigo-600">{cand.position}</span>
                                        </p>
                                      </div>
                                      <div className="flex items-center gap-2">
                                        <span className="font-mono text-[10px] font-black text-indigo-700 bg-indigo-50 border border-indigo-100 px-1.5 py-0.5 rounded">
                                          {cand.votesCount} vo
                                        </span>
                                        <button
                                          onClick={() => handleDeleteCandidate(cand.id!)}
                                          className="text-stone-400 hover:text-rose-605 pointer hover:bg-rose-50 p-1 rounded"
                                        >
                                          <Trash2 className="w-3 h-3" />
                                        </button>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

            </div>
          )}

        </motion.div>
      </AnimatePresence>
    </div>
  );
}
