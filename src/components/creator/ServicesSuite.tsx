import React, { useState } from 'react';
import {
  HelpCircle,
  Bell,
  Globe,
  Smartphone,
  Send,
  Check,
  AlertTriangle,
  Info,
  Trash2,
  Sliders,
  ChevronRight,
  Shield,
  Zap,
  CheckCircle2
} from 'lucide-react';
import { cn } from '../../lib/utils';

interface ServicesSuiteProps {
  activePanel: string;
  lockAnnouncementMsg: string;
  setLockAnnouncementMsg: (msg: string) => void;
  handleUpdateAnnouncement: () => void;
}

export default function ServicesSuite({
  activePanel,
  lockAnnouncementMsg,
  setLockAnnouncementMsg,
  handleUpdateAnnouncement
}: ServicesSuiteProps) {

  // Local state for Customer Support Tickets
  const [supportTickets, setSupportTickets] = useState<any[]>([
    { id: 't1', school: 'Accra Science Academy', issue: 'Continuous assessment marks columns show empty fields on grading terminal.', status: 'open', priority: 'high', date: '2026-07-01' },
    { id: 't2', school: 'Legon Academic Academy', issue: 'SMS Twilio gateway response code ENOTFOUND. Please verify credentials sync.', status: 'open', priority: 'medium', date: '2026-06-30' },
    { id: 't3', school: 'Tema International School', issue: 'How to upload school administrator digital signature files for report cards PDF?', status: 'resolved', priority: 'low', date: '2026-06-28' }
  ]);

  const [selectedTicket, setSelectedTicket] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');

  const handleSendReply = (ticketId: string) => {
    if (!replyText.trim()) return;
    setSupportTickets(supportTickets.map(t => {
      if (t.id === ticketId) {
        return { ...t, status: 'resolved', reply: replyText };
      }
      return t;
    }));
    setReplyText('');
    setSelectedTicket(null);
    alert("Support ticket response dispatched to client portal successfully!");
  };

  // Local state for CMS
  const [cmsSchoolName, setCmsSchoolName] = useState('SchoolSphere Academy');
  const [cmsSchoolLogo, setCmsSchoolLogo] = useState('https://cdn.pixabay.com/photo/2016/10/06/19/03/graduation-cap-1719744_1280.png');
  const [cmsTheme, setCmsTheme] = useState('Indigo Tech');

  // Local state for Mobile App
  const [mobileVersion, setMobileVersion] = useState('2.4.0');
  const [mobileApkLink, setMobileApkLink] = useState('https://storage.googleapis.com/schoolsphere-builds/android/v2.4.0-release.apk');
  const [mobilePushEnabled, setMobilePushEnabled] = useState(true);

  if (activePanel === 'customer_support') {
    return (
      <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs space-y-6">
        <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
          <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl">
            <HelpCircle className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-black text-slate-900 uppercase tracking-tight">Customer Support Tickets</h2>
            <p className="text-xs text-slate-500">Respond to active client inquiries and support tickets in real-time.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            <h3 className="text-xs font-black uppercase text-slate-400 tracking-wider">Inbound Support Desk</h3>
            <div className="space-y-3.5">
              {supportTickets.map((ticket) => (
                <div
                  key={ticket.id}
                  className={cn(
                    "p-4 rounded-2xl border transition-all cursor-pointer",
                    selectedTicket === ticket.id ? "bg-indigo-50/50 border-indigo-200 ring-2 ring-indigo-50/40" : "bg-white border-slate-200 hover:border-slate-300"
                  )}
                  onClick={() => setSelectedTicket(ticket.id)}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-slate-800 text-xs">{ticket.school}</span>
                        <span className={cn(
                          "text-[9px] px-2 py-0.5 rounded-full font-bold uppercase",
                          ticket.priority === 'high' ? "bg-rose-50 text-rose-600" :
                          ticket.priority === 'medium' ? "bg-amber-50 text-amber-600" : "bg-slate-100 text-slate-600"
                        )}>
                          {ticket.priority}
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 font-semibold">{ticket.issue}</p>
                    </div>
                    <span className={cn(
                      "text-[9px] font-black uppercase border px-2 py-0.5 rounded-full",
                      ticket.status === 'open' ? "bg-amber-50 text-amber-600 border-amber-100" : "bg-emerald-50 text-emerald-600 border-emerald-100"
                    )}>
                      {ticket.status}
                    </span>
                  </div>
                  {ticket.reply && (
                    <div className="mt-3 p-3 bg-emerald-50/50 border border-emerald-100 rounded-xl text-xs text-emerald-800 font-semibold">
                      <strong>Outbound Reply:</strong> {ticket.reply}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="lg:col-span-1 bg-slate-50/50 p-5 rounded-2xl border border-slate-200 h-fit">
            {selectedTicket ? (
              <div className="space-y-4">
                <h4 className="text-xs font-black uppercase text-slate-700 tracking-wider">Ticket Response Draft</h4>
                <textarea
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  placeholder="Type official support response..."
                  rows={4}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl focus:outline-hidden font-semibold text-xs text-slate-700 resize-none"
                />
                <button
                  onClick={() => handleSendReply(selectedTicket)}
                  className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition"
                >
                  <Send className="w-3.5 h-3.5" /> Dispatch Reply
                </button>
              </div>
            ) : (
              <div className="text-center py-8 text-slate-400 text-xs font-semibold">
                Select an open support ticket from the list to compose an official response.
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (activePanel === 'notifications') {
    return (
      <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs space-y-6">
        <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
          <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl">
            <Bell className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-black text-slate-900 uppercase tracking-tight">System Lock Screen Notice</h2>
            <p className="text-xs text-slate-500">Broadcast customized emergency announcements and warning banners onto locked portals.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-2 bg-slate-50/50 p-5 rounded-2xl border border-slate-200 space-y-4">
            <h3 className="text-xs font-black uppercase text-slate-700 tracking-wider flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-500" /> Lock Screen Message Composer
            </h3>
            <p className="text-xs text-slate-500">
              When a school portal is blocked or suspended, this specific announcement message is displayed directly on the login lock screen:
            </p>

            <textarea
              value={lockAnnouncementMsg}
              onChange={(e) => setLockAnnouncementMsg(e.target.value)}
              placeholder="e.g. Licensing validation required. Please contact Elena on akokosolutions24@gmail.com."
              rows={4}
              className="w-full px-4 py-3 bg-white border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 font-medium text-xs text-slate-700 focus:outline-hidden resize-none"
            />

            <button
              onClick={handleUpdateAnnouncement}
              className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold uppercase tracking-wider transition cursor-pointer"
            >
              Update Lockout Message
            </button>
          </div>

          <div className="md:col-span-1 bg-amber-50/20 border border-amber-100 p-5 rounded-2xl flex flex-col justify-between">
            <div className="space-y-3">
              <span className="text-[10px] bg-amber-100 text-amber-800 font-bold px-2.5 py-1 rounded-full uppercase">Lock Screen Preview</span>
              <p className="text-[11px] text-slate-600 leading-relaxed font-semibold">
                Below is how locked schools will view your banner:
              </p>
              <div className="p-3.5 bg-white border border-amber-200 rounded-xl space-y-2">
                <span className="text-[10px] font-bold text-rose-500 uppercase flex items-center gap-1">⚠️ Restricted Instance</span>
                <p className="text-[10px] text-slate-700 italic leading-normal font-semibold">"{lockAnnouncementMsg || 'Please activate licensing...'}"</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (activePanel === 'cms') {
    return (
      <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs space-y-6">
        <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
          <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl">
            <Globe className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-black text-slate-900 uppercase tracking-tight">CMS White-Label Branding</h2>
            <p className="text-xs text-slate-500">Configure default school identity properties and custom homepage logos.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-500 uppercase">Default Landing Portal Title</label>
              <input
                type="text"
                value={cmsSchoolName}
                onChange={(e) => setCmsSchoolName(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-hidden"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-500 uppercase">Default Branding Logo URL</label>
              <input
                type="text"
                value={cmsSchoolLogo}
                onChange={(e) => setCmsSchoolLogo(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-hidden"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-500 uppercase">Core Theme Selection</label>
              <select
                value={cmsTheme}
                onChange={(e) => setCmsTheme(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-hidden"
              >
                <option value="Indigo Tech">Indigo Tech (Modern Dark / Blue)</option>
                <option value="Forest Green">Forest Green (Eco Classical)</option>
                <option value="Midnight Rose">Midnight Rose (Creative Crimson)</option>
              </select>
            </div>
          </div>

          <div className="bg-slate-50 p-5 rounded-2xl border border-slate-150 flex flex-col justify-between">
            <div className="space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">White-Label Customizer Preview</h4>
              <div className="bg-white border border-slate-200 p-4 rounded-xl flex items-center gap-3">
                <img src={cmsSchoolLogo} className="w-8 h-8 object-contain rounded" alt="Logo preview" referrerPolicy="no-referrer" />
                <div>
                  <h5 className="font-bold text-xs text-slate-800">{cmsSchoolName}</h5>
                  <span className="text-[9px] text-slate-400 font-semibold uppercase">{cmsTheme} theme active</span>
                </div>
              </div>
            </div>

            <button
              onClick={() => alert("CMS Branding Customizations saved and cached in LocalStorage!")}
              className="mt-6 w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold uppercase tracking-wider transition"
            >
              Update Landing Assets
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (activePanel === 'mobile_app_management') {
    return (
      <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs space-y-6">
        <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
          <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl">
            <Smartphone className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-black text-slate-900 uppercase tracking-tight">Mobile App Management</h2>
            <p className="text-xs text-slate-500">Configure APK updates and Google Play release channels for Android student portal.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-500 uppercase">Play Console Version Build</label>
              <input
                type="text"
                value={mobileVersion}
                onChange={(e) => setMobileVersion(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-hidden"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-500 uppercase">APK File Endpoint Link</label>
              <input
                type="text"
                value={mobileApkLink}
                onChange={(e) => setMobileApkLink(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-hidden"
              />
            </div>

            <label className="flex items-center gap-2 cursor-pointer font-bold text-xs text-slate-700 pt-2 select-none">
              <input
                type="checkbox"
                checked={mobilePushEnabled}
                onChange={(e) => setMobilePushEnabled(e.target.checked)}
                className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
              />
              Auto-notify mobile users on term results publication
            </label>
          </div>

          <div className="bg-slate-50 p-5 rounded-2xl border border-slate-150 flex flex-col justify-between">
            <div className="space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">Current Android APK release metadata</h4>
              <div className="p-3.5 bg-white border border-slate-200 rounded-xl space-y-1">
                <span className="text-[10px] text-slate-500 block font-bold uppercase">BUILD ARCHITECTURE</span>
                <span className="text-xs font-mono font-bold text-indigo-600 block">Universal Android arm64-v8a</span>
                <span className="text-[10px] text-slate-500 block font-bold uppercase mt-2">DOWNLOAD ENVELOPE SIZE</span>
                <span className="text-xs font-mono font-bold text-slate-700 block">18.42 MB</span>
              </div>
            </div>

            <button
              onClick={() => alert("Mobile App Configuration variables updated!")}
              className="mt-6 w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold uppercase tracking-wider transition"
            >
              Push APK Release Changes
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
