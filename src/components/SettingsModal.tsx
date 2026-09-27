import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { AppSettings, DynamicShift, ShiftPreset, DocumentSection, DocumentHeaderMetaConfig, SignatureConfig, User } from '../types';
import {
  X,
  Settings,
  Sun,
  Moon,
  Clock,
  Sliders,
  Plus,
  Trash2,
  CheckCircle2,
  Sparkles,
  CalendarDays,
  KeyRound,
  Lock,
  BookmarkPlus,
  FolderSync,
  Check,
  Briefcase,
  FileText,
  FileCheck,
  Shield,
  Award,
  Target,
  Building2,
  Upload,
  Download,
  Image as ImageIcon
} from 'lucide-react';
import { DocumentTemplateEditor } from './DocumentTemplateEditor';
import {
  DEFAULT_JD_SECTIONS,
  DEFAULT_CONFIRMATION_SECTIONS,
  DEFAULT_APPOINTMENT_SECTIONS,
  DEFAULT_OFFER_LETTER_SECTIONS,
  DEFAULT_APPRAISAL_SECTIONS,
  DEFAULT_APPRAISAL_HEADER_META,
  DEFAULT_APPRAISAL_SIGNATURES,
  DEFAULT_HEADER_META,
  DEFAULT_SIGNATURES,
  getActiveOrganizationName
} from '../utils/documentTemplates';
import { updateCompanyOrganizationName, isCompanyIdTaken } from '../utils/userManagement';
import {
  normalizeCompanyId,
  deriveCompanyIdFromName,
  getActiveCompanyId,
  exportCompanyNetworkBackup,
  importCompanyNetworkBackup
} from '../utils/companyStorage';
import {
  getCentralCompanyLogo,
  saveCentralCompanyLogo,
  removeCentralCompanyLogo,
} from '../utils/logoStorage';
import { compressImage } from '../utils/imageUtils';
import { emitGlobalToast } from '../context/ToastContext';
import { generateFullDatabaseArchiveZip, restoreUniversalBackup } from '../utils/backupRestore';
import { FolderArchive, Users, ThumbsUp, ThumbsDown, AlertCircle } from 'lucide-react';
import { ExportPasswordModal } from './ExportPasswordModal';
import { RestorePasswordModal } from './RestorePasswordModal';
import {
  getActiveExportRequest,
  createExportRequest,
  voteOnExportRequest,
  cancelExportRequest,
  completeExportRequest,
  ExportConsensusRequest,
} from '../utils/exportConsensus';
import { getUsersByCompany } from '../utils/userManagement';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: AppSettings;
  onSaveSettings: (newSettings: AppSettings) => void;
  onClearAllData?: () => void;
  currentMonthYear?: string;
  onNavigateToDepartments?: () => void;
  onOpenAccessControl?: () => void;
  currentUser?: User;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  settings,
  onSaveSettings,
  onClearAllData,
  currentMonthYear = '2026-08',
  onNavigateToDepartments,
  onOpenAccessControl,
  currentUser,
}) => {
  const [theme, setTheme] = useState<'light' | 'dark'>(settings.theme || 'dark');
  const [columns, setColumns] = useState<string[]>(() => {
    if (Array.isArray(settings.extraColumns)) return settings.extraColumns;
    if (Array.isArray(settings.defaultColumns)) return settings.defaultColumns;
    return ['Shift Type', 'Supervisor Notes'];
  });
  const [autoSyncStaff, setAutoSyncStaff] = useState<boolean>(
    settings.autoSyncStaffFromAttendance ?? true
  );
  const [showClearConfirmModal, setShowClearConfirmModal] = useState(false);
  const [showSyncConfirmModal, setShowSyncConfirmModal] = useState(false);
  const [copiedBackup, setCopiedBackup] = useState(false);

  // Template editor views
  const [isEditingJdFormat, setIsEditingJdFormat] = useState<boolean>(false);
  const [isEditingConfirmationFormat, setIsEditingConfirmationFormat] = useState<boolean>(false);
  const [isEditingAppointmentFormat, setIsEditingAppointmentFormat] = useState<boolean>(false);
  const [isEditingAppraisalFormat, setIsEditingAppraisalFormat] = useState<boolean>(false);
  const [isEditingOfferLetterFormat, setIsEditingOfferLetterFormat] = useState<boolean>(false);

  // Organization & Global Company Branding State
  const [companyName, setCompanyName] = useState<string>(() => {
    if (settings.companyName && settings.companyName.trim()) return settings.companyName.trim();
    if (currentUser?.company && currentUser.company.trim()) return currentUser.company.trim();
    return getActiveOrganizationName(settings);
  });
  const [companyId, setCompanyId] = useState<string>(() => {
    if (settings.companyId && settings.companyId.trim()) return normalizeCompanyId(settings.companyId);
    if (currentUser?.companyId && currentUser.companyId.trim()) return normalizeCompanyId(currentUser.companyId);
    return getActiveCompanyId(settings.companyName || currentUser?.company);
  });
  const [companyLogo, setCompanyLogo] = useState<string | undefined>(() => {
    return (
      getCentralCompanyLogo(currentUser?.companyId || currentUser?.company || settings.companyId || settings.companyName) ||
      settings.companyLogo
    );
  });
  const logoInputRef = useRef<HTMLInputElement>(null);

  // Handle Logo Upload - Centralized system-wide
  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        emitGlobalToast('Company logo size must be under 5MB.', 'warning');
        return;
      }
      compressImage(file, 280, 280, 0.85).then((compressedBase64) => {
        const effective = compressedBase64 || '';
        if (!effective) return;
        setCompanyLogo(effective);
        saveCentralCompanyLogo(effective, companyId || currentUser?.companyId || currentUser?.company);
        if (!jdLogo) setJdLogo(effective);
        if (!confirmationLogo) setConfirmationLogo(effective);
        if (!appointmentLogo) setAppointmentLogo(effective);
        emitGlobalToast('Company logo updated and centralized system-wide!', 'success');
      });
    }
  };

  // JD Template State
  const [jdCompanyName, setJdCompanyName] = useState<string>(
    settings.jdCompanyName !== undefined ? settings.jdCompanyName : (settings.companyName || '')
  );
  const [jdLogo, setJdLogo] = useState<string | undefined>(settings.jdLogo || settings.companyLogo);
  const [jdLineColor, setJdLineColor] = useState<string>(settings.jdLineColor || '#0d9488');
  const [jdTextColor, setJdTextColor] = useState<string>(settings.jdTextColor || '#0f172a');
  const [jdDocumentTitle, setJdDocumentTitle] = useState<string>(
    settings.jdDocumentTitle || 'OFFICIAL STAFF JOB DESCRIPTION & PERFORMANCE CONTRACT'
  );
  const [jdEmployeeSigLabel, setJdEmployeeSigLabel] = useState<string>(
    settings.jdEmployeeSigLabel || 'Employee Acceptance & Signature'
  );
  const [jdHrSigLabel, setJdHrSigLabel] = useState<string>(
    settings.jdHrSigLabel || 'Authorized HR / Management Representative'
  );
  const [jdSections, setJdSections] = useState<DocumentSection[]>(() => {
    if (settings.jdSections && settings.jdSections.length > 0) {
      return settings.jdSections;
    }
    return DEFAULT_JD_SECTIONS;
  });
  const [jdHeaderMeta, setJdHeaderMeta] = useState<DocumentHeaderMetaConfig>(
    settings.jdHeaderMeta || DEFAULT_HEADER_META
  );
  const [jdSignatures, setJdSignatures] = useState<SignatureConfig>(
    settings.jdSignatures || DEFAULT_SIGNATURES
  );

  // Confirmation Letter Template State
  const [confirmationCompanyName, setConfirmationCompanyName] = useState<string>(
    settings.confirmationCompanyName !== undefined
      ? settings.confirmationCompanyName
      : (settings.companyName || '')
  );
  const [confirmationLogo, setConfirmationLogo] = useState<string | undefined>(settings.confirmationLogo || settings.companyLogo);
  const [confirmationLineColor, setConfirmationLineColor] = useState<string>(settings.confirmationLineColor || '#2563eb');
  const [confirmationTextColor, setConfirmationTextColor] = useState<string>(settings.confirmationTextColor || '#0f172a');
  const [confirmationDocumentTitle, setConfirmationDocumentTitle] = useState<string>(
    settings.confirmationDocumentTitle || 'OFFICIAL LETTER OF EMPLOYMENT CONFIRMATION'
  );
  const [confirmationEmployeeSigLabel, setConfirmationEmployeeSigLabel] = useState<string>(
    settings.confirmationEmployeeSigLabel || 'Employee Acceptance & Acknowledgement'
  );
  const [confirmationHrSigLabel, setConfirmationHrSigLabel] = useState<string>(
    settings.confirmationHrSigLabel || 'Authorized HR / Management Representative'
  );
  const [confirmationSections, setConfirmationSections] = useState<DocumentSection[]>(() => {
    if (settings.confirmationSections && settings.confirmationSections.length > 0) {
      return settings.confirmationSections;
    }
    return DEFAULT_CONFIRMATION_SECTIONS;
  });
  const [confirmationHeaderMeta, setConfirmationHeaderMeta] = useState<DocumentHeaderMetaConfig>(
    settings.confirmationHeaderMeta || DEFAULT_HEADER_META
  );
  const [confirmationSignatures, setConfirmationSignatures] = useState<SignatureConfig>(
    settings.confirmationSignatures || DEFAULT_SIGNATURES
  );

  // Appointment Letter Template State
  const [appointmentCompanyName, setAppointmentCompanyName] = useState<string>(
    settings.appointmentCompanyName !== undefined
      ? settings.appointmentCompanyName
      : (settings.companyName || '')
  );
  const [appointmentLogo, setAppointmentLogo] = useState<string | undefined>(settings.appointmentLogo || settings.companyLogo);
  const [appointmentLineColor, setAppointmentLineColor] = useState<string>(settings.appointmentLineColor || '#4f46e5');
  const [appointmentTextColor, setAppointmentTextColor] = useState<string>(settings.appointmentTextColor || '#0f172a');
  const [appointmentDocumentTitle, setAppointmentDocumentTitle] = useState<string>(
    settings.appointmentDocumentTitle || 'OFFICIAL LETTER OF APPOINTMENT'
  );
  const [appointmentEmployeeSigLabel, setAppointmentEmployeeSigLabel] = useState<string>(
    settings.appointmentEmployeeSigLabel || 'Appointee Acceptance & Signature'
  );
  const [appointmentHrSigLabel, setAppointmentHrSigLabel] = useState<string>(
    settings.appointmentHrSigLabel || 'Managing Director / Authorized Representative'
  );
  const [appointmentSections, setAppointmentSections] = useState<DocumentSection[]>(() => {
    if (settings.appointmentSections && settings.appointmentSections.length > 0) {
      return settings.appointmentSections;
    }
    return DEFAULT_APPOINTMENT_SECTIONS;
  });
  const [appointmentHeaderMeta, setAppointmentHeaderMeta] = useState<DocumentHeaderMetaConfig>(
    settings.appointmentHeaderMeta || DEFAULT_HEADER_META
  );
  const [appointmentSignatures, setAppointmentSignatures] = useState<SignatureConfig>(
    settings.appointmentSignatures || DEFAULT_SIGNATURES
  );

  // Appraisal Letter / KPI Template State
  const [appraisalCompanyName, setAppraisalCompanyName] = useState<string>(
    settings.appraisalCompanyName !== undefined
      ? settings.appraisalCompanyName
      : (settings.companyName || '')
  );
  const [appraisalLogo, setAppraisalLogo] = useState<string | undefined>(settings.appraisalLogo || settings.companyLogo);
  const [appraisalLineColor, setAppraisalLineColor] = useState<string>(settings.appraisalLineColor || '#d97706');
  const [appraisalTextColor, setAppraisalTextColor] = useState<string>(settings.appraisalTextColor || '#0f172a');
  const [appraisalDocumentTitle, setAppraisalDocumentTitle] = useState<string>(
    settings.appraisalDocumentTitle || 'OFFICIAL PERFORMANCE APPRAISAL & KPI EVALUATION'
  );
  const [appraisalEmployeeSigLabel, setAppraisalEmployeeSigLabel] = useState<string>(
    settings.appraisalEmployeeSigLabel || 'Appraisee Acknowledgment & Signature'
  );
  const [appraisalHrSigLabel, setAppraisalHrSigLabel] = useState<string>(
    settings.appraisalHrSigLabel || 'Appraising Supervisor / Reviewer Signature'
  );
  const [appraisalSections, setAppraisalSections] = useState<DocumentSection[]>(() => {
    if (settings.appraisalSections && settings.appraisalSections.length > 0) {
      return settings.appraisalSections;
    }
    return DEFAULT_APPRAISAL_SECTIONS;
  });
  const [appraisalHeaderMeta, setAppraisalHeaderMeta] = useState<DocumentHeaderMetaConfig>(
    settings.appraisalHeaderMeta || DEFAULT_APPRAISAL_HEADER_META
  );
  const [appraisalSignatures, setAppraisalSignatures] = useState<SignatureConfig>(
    settings.appraisalSignatures || DEFAULT_APPRAISAL_SIGNATURES
  );

  // Offer Letter Template State (Candidate Onboarding Pipeline)
  const [offerLetterCompanyName, setOfferLetterCompanyName] = useState<string>(
    settings.offerLetterCompanyName !== undefined
      ? settings.offerLetterCompanyName
      : (settings.companyName || '')
  );
  const [offerLetterLogo, setOfferLetterLogo] = useState<string | undefined>(settings.offerLetterLogo || settings.companyLogo);
  const [offerLetterLineColor, setOfferLetterLineColor] = useState<string>(settings.offerLetterLineColor || '#059669');
  const [offerLetterTextColor, setOfferLetterTextColor] = useState<string>(settings.offerLetterTextColor || '#0f172a');
  const [offerLetterDocumentTitle, setOfferLetterDocumentTitle] = useState<string>(
    settings.offerLetterDocumentTitle || 'OFFICIAL OFFER OF EMPLOYMENT & APPOINTMENT TERMS'
  );
  const [offerLetterEmployeeSigLabel, setOfferLetterEmployeeSigLabel] = useState<string>(
    settings.offerLetterEmployeeSigLabel || 'Candidate Acceptance & Signature'
  );
  const [offerLetterHrSigLabel, setOfferLetterHrSigLabel] = useState<string>(
    settings.offerLetterHrSigLabel || 'Managing Director / Authorized Representative'
  );
  const [offerLetterSections, setOfferLetterSections] = useState<DocumentSection[]>(() => {
    if (settings.offerLetterSections && settings.offerLetterSections.length > 0) {
      return settings.offerLetterSections;
    }
    return DEFAULT_OFFER_LETTER_SECTIONS;
  });
  const [offerLetterHeaderMeta, setOfferLetterHeaderMeta] = useState<DocumentHeaderMetaConfig>(
    settings.offerLetterHeaderMeta || DEFAULT_HEADER_META
  );
  const [offerLetterSignatures, setOfferLetterSignatures] = useState<SignatureConfig>(
    settings.offerLetterSignatures || DEFAULT_SIGNATURES
  );

  // Dynamic Shift State
  const [shifts, setShifts] = useState<DynamicShift[]>(
    settings.shifts || [
      {
        id: 'shift-dynamic-default',
        name: 'Standard Dynamic Shift',
        startTime: settings.resumptionTime || '08:00',
        endTime: settings.closingTime || '17:00',
        gracePeriodMinutes: settings.gracePeriodMinutes ?? 15,
      },
      {
        id: 'shift-morning',
        name: 'Morning Shift',
        startTime: '08:00',
        endTime: '17:00',
        gracePeriodMinutes: 15,
      },
      {
        id: 'shift-afternoon',
        name: 'Afternoon Shift',
        startTime: '14:00',
        endTime: '22:00',
        gracePeriodMinutes: 10,
      },
      {
        id: 'shift-night',
        name: 'Night Shift',
        startTime: '22:00',
        endTime: '06:00',
        gracePeriodMinutes: 15,
      },
    ]
  );

  // Shift Presets
  const [savedPresets, setSavedPresets] = useState<ShiftPreset[]>(
    settings.savedShiftPresets || [
      {
        id: 'preset-standard-3',
        presetName: 'Standard 3-Tier Production Roster',
        shifts: [
          {
            id: 'shift-f1',
            name: 'Morning Shift',
            startTime: '06:00',
            endTime: '14:00',
            gracePeriodMinutes: 10,
          },
          {
            id: 'shift-f2',
            name: 'Afternoon Shift',
            startTime: '14:00',
            endTime: '22:00',
            gracePeriodMinutes: 10,
          },
          {
            id: 'shift-f3',
            name: 'Night Shift',
            startTime: '22:00',
            endTime: '06:00',
            gracePeriodMinutes: 15,
          },
        ],
        createdAt: new Date().toISOString().split('T')[0],
      },
    ]
  );

  // Active selected shift for inspection/editing
  const [selectedShiftId, setSelectedShiftId] = useState<string>(() => {
    return (shifts && shifts.length > 0) ? shifts[0].id : 'shift-morning';
  });

  // New Shift Inline Form State
  const [isAddingShift, setIsAddingShift] = useState(false);
  const [newShiftName, setNewShiftName] = useState('');
  const [newShiftStart, setNewShiftStart] = useState('08:00');
  const [newShiftEnd, setNewShiftEnd] = useState('17:00');
  const [newShiftGrace, setNewShiftGrace] = useState(15);

  // Save Preset Modal State
  const [isSavingPreset, setIsSavingPreset] = useState(false);
  const [presetNameInput, setPresetNameInput] = useState('');

  const [uploadBackupStatus, setUploadBackupStatus] = useState<{ success?: boolean; message?: string } | null>(null);
  const [isExportingBackup, setIsExportingBackup] = useState(false);
  const [isRestoringBackup, setIsRestoringBackup] = useState(false);

  // Password & Consensus Modals State
  const [showExportPasswordModal, setShowExportPasswordModal] = useState(false);
  const [showRestorePasswordModal, setShowRestorePasswordModal] = useState(false);
  const [selectedRestoreFile, setSelectedRestoreFile] = useState<File | null>(null);
  const [restoreErrorMessage, setRestoreErrorMessage] = useState<string | null>(null);

  // Consensus State
  const [consensusRequest, setConsensusRequest] = useState<ExportConsensusRequest | null>(() =>
    getActiveExportRequest(companyId || getActiveCompanyId())
  );
  const [consensusNotice, setConsensusNotice] = useState<string | null>(null);

  if (!isOpen) return null;

  // Calculate Weekend breakdown for current/selected month
  const getWeekendBreakdown = (mYear: string) => {
    const [yearStr, monthStr] = mYear.split('-');
    const year = parseInt(yearStr) || 2026;
    const month = parseInt(monthStr) || 8;
    const totalDays = new Date(year, month, 0).getDate();

    let saturdays = 0;
    let sundays = 0;

    for (let day = 1; day <= totalDays; day++) {
      const dayOfWeek = new Date(year, month - 1, day).getDay();
      if (dayOfWeek === 6) saturdays++;
      if (dayOfWeek === 0) sundays++;
    }

    const monthName = new Date(year, month - 1, 1).toLocaleString('default', { month: 'long' });

    return {
      monthName,
      year,
      totalDays,
      saturdays,
      sundays,
      totalWeekends: saturdays + sundays,
    };
  };

  const weekendInfo = getWeekendBreakdown(currentMonthYear);

  // Calculate late cutoff time string
  const calculateCutoffTime = (startTime: string, graceMins: number) => {
    if (!startTime || !startTime.includes(':')) return 'N/A';
    const [h, m] = startTime.split(':').map(Number);
    const total = (h || 0) * 60 + (m || 0) + (graceMins || 0);
    const cutH = Math.floor((total % (24 * 60)) / 60);
    const cutM = total % 60;
    return `${String(cutH).padStart(2, '0')}:${String(cutM).padStart(2, '0')}`;
  };

  // Add Dynamic Shift
  const handleCreateShift = () => {
    if (!newShiftName.trim()) return;
    const created: DynamicShift = {
      id: `shift-${Date.now()}`,
      name: newShiftName.trim(),
      startTime: newShiftStart,
      endTime: newShiftEnd,
      gracePeriodMinutes: newShiftGrace,
    };
    const nextShifts = [...shifts, created];
    setShifts(nextShifts);
    setSelectedShiftId(created.id);
    setNewShiftName('');
    setIsAddingShift(false);
  };

  const handleUpdateShift = (id: string, field: keyof DynamicShift, val: any) => {
    setShifts(
      shifts.map((s) => (s.id === id ? { ...s, [field]: val } : s))
    );
  };

  const handleDeleteShift = (id: string) => {
    if (shifts.length <= 1) {
      emitGlobalToast('You must have at least one active shift schedule in your system.', 'warning');
      return;
    }
    const filtered = shifts.filter((s) => s.id !== id);
    setShifts(filtered);
    if (selectedShiftId === id) {
      setSelectedShiftId(filtered[0]?.id || '');
    }
  };

  const effectiveUser: User = currentUser || {
    id: 'usr-admin-1',
    name: 'Administrator',
    email: 'admin@company.com',
    role: 'Admin',
    company: companyName || 'Company',
  };

  const handleInitiateExport = () => {
    setConsensusNotice(null);
    const companyUsers = getUsersByCompany(companyId || companyName);

    // Sole user / single account organization bypasses multi-user waiting
    if (companyUsers.length <= 1) {
      setShowExportPasswordModal(true);
      return;
    }

    const activeReq = getActiveExportRequest(companyId);
    if (activeReq && activeReq.status === 'approved') {
      setShowExportPasswordModal(true);
      return;
    }

    if (activeReq && activeReq.status === 'pending') {
      setConsensusRequest(activeReq);
      setConsensusNotice('An export request is currently pending team consensus. Check the approvals below.');
      return;
    }

    // Create a new export consensus request
    const newReq = createExportRequest(effectiveUser, companyId, companyName);
    setConsensusRequest(newReq);

    if (newReq.status === 'approved') {
      setShowExportPasswordModal(true);
    } else {
      setConsensusNotice(`Export request created! Requires ${newReq.requiredApprovals} of ${newReq.totalCompanyUsers} accounts (including Admin) to accept.`);
    }
  };

  const handleVoteConsensus = (approve: boolean) => {
    if (!consensusRequest) return;
    const { request, isApproved } = voteOnExportRequest(
      consensusRequest.id,
      effectiveUser,
      companyId,
      approve,
      companyName
    );
    setConsensusRequest(request);
    if (isApproved) {
      setConsensusNotice('Export request approved by team consensus! You can now set the export password to download.');
    } else if (request?.status === 'rejected') {
      setConsensusNotice('Export request was rejected by team members.');
    }
  };

  const handleCancelConsensus = () => {
    cancelExportRequest(companyId);
    setConsensusRequest(null);
    setConsensusNotice('Export request cancelled.');
  };

  const handleConfirmExportWithPassword = async (password: string) => {
    try {
      setIsExportingBackup(true);
      const { blob, fileName } = await generateFullDatabaseArchiveZip(companyId || companyName, password);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      completeExportRequest(companyId);
      setConsensusRequest(null);
      setUploadBackupStatus({
        success: true,
        message: 'Database backup successfully encrypted and downloaded! Keep your password safe for future restoration.',
      });
    } catch (err: any) {
      throw new Error(`Export encryption error: ${err.message || 'Unknown error'}`);
    } finally {
      setIsExportingBackup(false);
    }
  };

  const handleUploadDatabaseBackup = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSelectedRestoreFile(file);
    setUploadBackupStatus(null);
    setRestoreErrorMessage(null);

    try {
      const result = await restoreUniversalBackup(file, undefined, companyId, companyName);
      if (result.requiresPassword) {
        setShowRestorePasswordModal(true);
      } else if (result.success) {
        setUploadBackupStatus({
          success: true,
          message: result.details || `Database successfully restored for ${result.companyName || result.companyId}! Page is reloading...`,
        });
        setTimeout(() => {
          window.location.reload();
        }, 1300);
      } else {
        setUploadBackupStatus({
          success: false,
          message: result.error || 'Failed to restore database: Invalid backup structure.',
        });
      }
    } catch (err: any) {
      setUploadBackupStatus({
        success: false,
        message: `Error restoring backup: ${err.message || 'Corrupt format'}`,
      });
    }
  };

  const handleConfirmRestoreWithPassword = async (password: string) => {
    if (!selectedRestoreFile) return;
    try {
      setIsRestoringBackup(true);
      setRestoreErrorMessage(null);
      const result = await restoreUniversalBackup(selectedRestoreFile, password, companyId, companyName);

      if (result.success) {
        setShowRestorePasswordModal(false);
        setUploadBackupStatus({
          success: true,
          message: result.details || `Database successfully decrypted and restored into ${companyName}! Page is reloading...`,
        });
        setTimeout(() => {
          window.location.reload();
        }, 1300);
      } else {
        setRestoreErrorMessage(result.error || 'Incorrect decryption password. Verification failed.');
        throw new Error(result.error || 'Incorrect decryption password. Verification failed.');
      }
    } finally {
      setIsRestoringBackup(false);
    }
  };

  const handleSaveCurrentAsPreset = () => {
    if (!presetNameInput.trim()) return;
    const newPreset: ShiftPreset = {
      id: `preset-${Date.now()}`,
      presetName: presetNameInput.trim(),
      shifts: [...shifts],
      createdAt: new Date().toISOString().split('T')[0],
    };
    setSavedPresets([...savedPresets, newPreset]);
    setPresetNameInput('');
    setIsSavingPreset(false);
    emitGlobalToast(`Shift preset "${newPreset.presetName}" saved successfully`, 'success');
  };

  const handleLoadPreset = (preset: ShiftPreset) => {
    setShifts([...preset.shifts]);
    emitGlobalToast(`Loaded shift preset "${preset.presetName}"`, 'info');
  };

  const handleAddColumn = () => {
    setColumns([...columns, `Header ${columns.length + 1}`]);
  };

  const handleUpdateColumn = (idx: number, val: string) => {
    const updated = [...columns];
    updated[idx] = val;
    setColumns(updated);
  };

  const handleRemoveColumn = (idx: number) => {
    if (columns.length <= 1) return;
    setColumns(columns.filter((_, i) => i !== idx));
  };

  const handleSave = (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    const defaultShift = shifts[0] || {
      startTime: '08:00',
      endTime: '17:00',
      gracePeriodMinutes: 15,
    };

    const finalCompanyName = companyName.trim();
    const finalCompanyId = normalizeCompanyId(companyId) || deriveCompanyIdFromName(finalCompanyName);

    if (finalCompanyId && isCompanyIdTaken(finalCompanyId, settings.companyName || currentUser?.company || '')) {
      emitGlobalToast(`Company ID "${finalCompanyId}" is already registered to another organization. Company IDs must be strictly unique.`, 'warning');
      return;
    }

    if (finalCompanyName) {
      updateCompanyOrganizationName(
        settings.companyName || currentUser?.company || '',
        finalCompanyName,
        finalCompanyId
      );
    }

    const cleanColumns = columns.filter((c) => c.trim() !== '');

    onSaveSettings({
      ...settings,
      companyName: finalCompanyName || settings.companyName,
      companyId: finalCompanyId,
      companyLogo,
      theme,
      resumptionTime: defaultShift.startTime,
      closingTime: defaultShift.endTime,
      gracePeriodMinutes: defaultShift.gracePeriodMinutes,
      defaultColumns: cleanColumns,
      extraColumns: cleanColumns,
      autoSyncStaffFromAttendance: autoSyncStaff,
      shifts,
      savedShiftPresets: savedPresets,
      // JD Template
      jdCompanyName: jdCompanyName.trim() || finalCompanyName,
      jdLogo: jdLogo || companyLogo,
      jdLineColor,
      jdTextColor,
      jdDocumentTitle,
      jdEmployeeSigLabel,
      jdHrSigLabel,
      jdSections,
      jdHeaderMeta,
      jdSignatures,
      // Confirmation Letter Template
      confirmationCompanyName: confirmationCompanyName.trim() || finalCompanyName,
      confirmationLogo: confirmationLogo || companyLogo,
      confirmationLineColor,
      confirmationTextColor,
      confirmationDocumentTitle,
      confirmationEmployeeSigLabel,
      confirmationHrSigLabel,
      confirmationSections,
      confirmationHeaderMeta,
      confirmationSignatures,
      // Appointment Letter Template
      appointmentCompanyName: appointmentCompanyName.trim() || finalCompanyName,
      appointmentLogo: appointmentLogo || companyLogo,
      appointmentLineColor,
      appointmentTextColor,
      appointmentDocumentTitle,
      appointmentEmployeeSigLabel,
      appointmentHrSigLabel,
      appointmentSections,
      appointmentHeaderMeta,
      appointmentSignatures,
      // Appraisal Letter Template
      appraisalCompanyName: appraisalCompanyName.trim() || finalCompanyName,
      appraisalLogo: appraisalLogo || companyLogo,
      appraisalLineColor,
      appraisalTextColor,
      appraisalDocumentTitle,
      appraisalEmployeeSigLabel,
      appraisalHrSigLabel,
      appraisalSections,
      appraisalHeaderMeta,
      appraisalSignatures,
      // Candidate Offer Letter Template
      offerLetterCompanyName: offerLetterCompanyName.trim() || finalCompanyName,
      offerLetterLogo: offerLetterLogo || companyLogo,
      offerLetterLineColor,
      offerLetterTextColor,
      offerLetterDocumentTitle,
      offerLetterEmployeeSigLabel,
      offerLetterHrSigLabel,
      offerLetterSections,
      offerLetterHeaderMeta,
      offerLetterSignatures,
    });
    emitGlobalToast('System settings saved successfully', 'success');
    onClose();
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          className={`relative w-full ${
            isEditingJdFormat || isEditingConfirmationFormat || isEditingAppointmentFormat || isEditingAppraisalFormat || isEditingOfferLetterFormat
              ? 'max-w-5xl'
              : 'max-w-2xl'
          } max-h-[90vh] rounded-3xl bg-slate-900 border border-slate-800 text-white shadow-2xl overflow-y-auto p-6 md:p-8 space-y-6 transition-all`}
        >
          {isEditingJdFormat ? (
            <DocumentTemplateEditor
              documentType="jd"
              title="Job Description (.doc & Print) Template Editor"
              subtitle="Customize official letterhead, dynamic clauses, duties tables, and signature blocks."
              colorScheme="teal"
              companyName={jdCompanyName}
              setCompanyName={setJdCompanyName}
              registeredCompanyName={getActiveOrganizationName(settings)}
              documentTitle={jdDocumentTitle}
              setDocumentTitle={setJdDocumentTitle}
              sections={jdSections}
              setSections={setJdSections}
              hrSigLabel={jdHrSigLabel}
              setHrSigLabel={setJdHrSigLabel}
              empSigLabel={jdEmployeeSigLabel}
              setEmpSigLabel={setJdEmployeeSigLabel}
              companyLogo={jdLogo}
              setCompanyLogo={(logo) => {
                setJdLogo(logo);
                if (!companyLogo) setCompanyLogo(logo);
              }}
              lineColor={jdLineColor}
              setLineColor={setJdLineColor}
              textColor={jdTextColor}
              setTextColor={setJdTextColor}
              headerMeta={jdHeaderMeta}
              setHeaderMeta={setJdHeaderMeta}
              signatures={jdSignatures}
              setSignatures={setJdSignatures}
              onResetDefault={() => {
                setJdCompanyName('');
                setJdLogo(undefined);
                setJdLineColor('#0d9488');
                setJdTextColor('#0f172a');
                setJdDocumentTitle('OFFICIAL STAFF JOB DESCRIPTION & PERFORMANCE CONTRACT');
                setJdEmployeeSigLabel('Employee Acceptance & Signature');
                setJdHrSigLabel('Authorized HR / Management Representative');
                setJdSections(DEFAULT_JD_SECTIONS);
                setJdHeaderMeta(DEFAULT_HEADER_META);
                setJdSignatures(DEFAULT_SIGNATURES);
              }}
              onSave={() => {
                handleSave();
                setIsEditingJdFormat(false);
              }}
              onBack={() => setIsEditingJdFormat(false)}
              onClose={onClose}
            />
          ) : isEditingConfirmationFormat ? (
            <DocumentTemplateEditor
              documentType="confirmation"
              title="Confirmation Letter (.doc & Print) Template Editor"
              subtitle="Customize official letterhead, appointment clauses, salutations, dynamic compensation tags, and signature blocks."
              colorScheme="blue"
              companyName={confirmationCompanyName}
              setCompanyName={setConfirmationCompanyName}
              registeredCompanyName={getActiveOrganizationName(settings)}
              documentTitle={confirmationDocumentTitle}
              setDocumentTitle={setConfirmationDocumentTitle}
              sections={confirmationSections}
              setSections={setConfirmationSections}
              hrSigLabel={confirmationHrSigLabel}
              setHrSigLabel={setConfirmationHrSigLabel}
              empSigLabel={confirmationEmployeeSigLabel}
              setEmpSigLabel={setConfirmationEmployeeSigLabel}
              companyLogo={confirmationLogo}
              setCompanyLogo={(logo) => {
                setConfirmationLogo(logo);
                if (!companyLogo) setCompanyLogo(logo);
              }}
              lineColor={confirmationLineColor}
              setLineColor={setConfirmationLineColor}
              textColor={confirmationTextColor}
              setTextColor={setConfirmationTextColor}
              headerMeta={confirmationHeaderMeta}
              setHeaderMeta={setConfirmationHeaderMeta}
              signatures={confirmationSignatures}
              setSignatures={setConfirmationSignatures}
              onResetDefault={() => {
                setConfirmationCompanyName('');
                setConfirmationLogo(undefined);
                setConfirmationLineColor('#2563eb');
                setConfirmationTextColor('#0f172a');
                setConfirmationDocumentTitle('OFFICIAL LETTER OF EMPLOYMENT CONFIRMATION');
                setConfirmationEmployeeSigLabel('Employee Acceptance & Acknowledgement');
                setConfirmationHrSigLabel('Authorized HR / Management Representative');
                setConfirmationSections(DEFAULT_CONFIRMATION_SECTIONS);
                setConfirmationHeaderMeta(DEFAULT_HEADER_META);
                setConfirmationSignatures(DEFAULT_SIGNATURES);
              }}
              onSave={() => {
                handleSave();
                setIsEditingConfirmationFormat(false);
              }}
              onBack={() => setIsEditingConfirmationFormat(false)}
              onClose={onClose}
            />
          ) : isEditingAppointmentFormat ? (
            <DocumentTemplateEditor
              documentType="appointment"
              title="Appointment Letter (.doc & Print) Template Editor"
              subtitle="Customize terms of employment, probationary period, compensation clauses, and acceptance blocks."
              colorScheme="indigo"
              companyName={appointmentCompanyName}
              setCompanyName={setAppointmentCompanyName}
              registeredCompanyName={getActiveOrganizationName(settings)}
              documentTitle={appointmentDocumentTitle}
              setDocumentTitle={setAppointmentDocumentTitle}
              sections={appointmentSections}
              setSections={setAppointmentSections}
              hrSigLabel={appointmentHrSigLabel}
              setHrSigLabel={setAppointmentHrSigLabel}
              empSigLabel={appointmentEmployeeSigLabel}
              setEmpSigLabel={setAppointmentEmployeeSigLabel}
              companyLogo={appointmentLogo}
              setCompanyLogo={(logo) => {
                setAppointmentLogo(logo);
                if (!companyLogo) setCompanyLogo(logo);
              }}
              lineColor={appointmentLineColor}
              setLineColor={setAppointmentLineColor}
              textColor={appointmentTextColor}
              setTextColor={setAppointmentTextColor}
              headerMeta={appointmentHeaderMeta}
              setHeaderMeta={setAppointmentHeaderMeta}
              signatures={appointmentSignatures}
              setSignatures={setAppointmentSignatures}
              onResetDefault={() => {
                setAppointmentCompanyName('');
                setAppointmentLogo(undefined);
                setAppointmentLineColor('#4f46e5');
                setAppointmentTextColor('#0f172a');
                setAppointmentDocumentTitle('OFFICIAL LETTER OF APPOINTMENT');
                setAppointmentEmployeeSigLabel('Appointee Acceptance & Signature');
                setAppointmentHrSigLabel('Managing Director / Authorized Representative');
                setAppointmentSections(DEFAULT_APPOINTMENT_SECTIONS);
                setAppointmentHeaderMeta(DEFAULT_HEADER_META);
                setAppointmentSignatures(DEFAULT_SIGNATURES);
              }}
              onSave={() => {
                handleSave();
                setIsEditingAppointmentFormat(false);
              }}
              onBack={() => setIsEditingAppointmentFormat(false)}
              onClose={onClose}
            />
          ) : isEditingAppraisalFormat ? (
            <DocumentTemplateEditor
              documentType="appraisal"
              title="Performance Appraisal & KPI (.doc & Print) Template Editor"
              subtitle="Customize KPI tables, duty filters (All/Key/Normal), weight sorting, evaluation ratings, and reviewer sign-offs."
              colorScheme="amber"
              companyName={appraisalCompanyName}
              setCompanyName={setAppraisalCompanyName}
              registeredCompanyName={getActiveOrganizationName(settings)}
              documentTitle={appraisalDocumentTitle}
              setDocumentTitle={setAppraisalDocumentTitle}
              sections={appraisalSections}
              setSections={setAppraisalSections}
              hrSigLabel={appraisalHrSigLabel}
              setHrSigLabel={setAppraisalHrSigLabel}
              empSigLabel={appraisalEmployeeSigLabel}
              setEmpSigLabel={setAppraisalEmployeeSigLabel}
              companyLogo={appraisalLogo}
              setCompanyLogo={(logo) => {
                setAppraisalLogo(logo);
                if (!companyLogo) setCompanyLogo(logo);
              }}
              lineColor={appraisalLineColor}
              setLineColor={setAppraisalLineColor}
              textColor={appraisalTextColor}
              setTextColor={setAppraisalTextColor}
              headerMeta={appraisalHeaderMeta}
              setHeaderMeta={setAppraisalHeaderMeta}
              signatures={appraisalSignatures}
              setSignatures={setAppraisalSignatures}
              onResetDefault={() => {
                setAppraisalCompanyName('');
                setAppraisalLogo(undefined);
                setAppraisalLineColor('#d97706');
                setAppraisalTextColor('#0f172a');
                setAppraisalDocumentTitle('OFFICIAL PERFORMANCE APPRAISAL & KPI EVALUATION');
                setAppraisalEmployeeSigLabel('Appraisee Acknowledgment & Signature');
                setAppraisalHrSigLabel('Appraising Supervisor / Reviewer Signature');
                setAppraisalSections(DEFAULT_APPRAISAL_SECTIONS);
                setAppraisalHeaderMeta(DEFAULT_APPRAISAL_HEADER_META);
                setAppraisalSignatures(DEFAULT_APPRAISAL_SIGNATURES);
              }}
              onSave={() => {
                handleSave();
                setIsEditingAppraisalFormat(false);
              }}
              onBack={() => setIsEditingAppraisalFormat(false)}
              onClose={onClose}
            />
          ) : isEditingOfferLetterFormat ? (
            <DocumentTemplateEditor
              documentType="offer"
              title="Candidate Offer Letter (.doc & Print) Template Editor"
              subtitle="Customize conditional offer terms, remuneration structure, probationary clauses, and candidate acceptance blocks."
              colorScheme="emerald"
              companyName={offerLetterCompanyName}
              setCompanyName={setOfferLetterCompanyName}
              registeredCompanyName={getActiveOrganizationName(settings)}
              documentTitle={offerLetterDocumentTitle}
              setDocumentTitle={setOfferLetterDocumentTitle}
              sections={offerLetterSections}
              setSections={setOfferLetterSections}
              hrSigLabel={offerLetterHrSigLabel}
              setHrSigLabel={setOfferLetterHrSigLabel}
              empSigLabel={offerLetterEmployeeSigLabel}
              setEmpSigLabel={setOfferLetterEmployeeSigLabel}
              companyLogo={offerLetterLogo}
              setCompanyLogo={(logo) => {
                setOfferLetterLogo(logo);
                if (!companyLogo) setCompanyLogo(logo);
              }}
              lineColor={offerLetterLineColor}
              setLineColor={setOfferLetterLineColor}
              textColor={offerLetterTextColor}
              setTextColor={setOfferLetterTextColor}
              headerMeta={offerLetterHeaderMeta}
              setHeaderMeta={setOfferLetterHeaderMeta}
              signatures={offerLetterSignatures}
              setSignatures={setOfferLetterSignatures}
              onResetDefault={() => {
                setOfferLetterCompanyName('');
                setOfferLetterLogo(undefined);
                setOfferLetterLineColor('#059669');
                setOfferLetterTextColor('#0f172a');
                setOfferLetterDocumentTitle('OFFICIAL OFFER OF EMPLOYMENT & APPOINTMENT TERMS');
                setOfferLetterEmployeeSigLabel('Candidate Acceptance & Signature');
                setOfferLetterHrSigLabel('Managing Director / Authorized Representative');
                setOfferLetterSections(DEFAULT_OFFER_LETTER_SECTIONS);
                setOfferLetterHeaderMeta(DEFAULT_HEADER_META);
                setOfferLetterSignatures(DEFAULT_SIGNATURES);
              }}
              onSave={() => {
                handleSave();
                setIsEditingOfferLetterFormat(false);
              }}
              onBack={() => setIsEditingOfferLetterFormat(false)}
              onClose={onClose}
            />
          ) : (
            <>
              {/* Header */}
              <div className="flex items-center justify-between pb-4 border-b border-slate-800">
                <div className="flex items-center gap-3">
                  <div className="p-3 rounded-2xl bg-blue-600/20 text-blue-400 border border-blue-500/30">
                    <Settings className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="font-bold text-lg text-white">Shift Schedules & System Configurations</h3>
                    <p className="text-xs text-slate-400 font-mono">
                      Dynamic Shift Times, Auto-Sync Policy, Presets & Document Templates
                    </p>
                  </div>
                </div>
                <button
                  onClick={onClose}
                  className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSave} className="space-y-6">
                {/* 0. Registered Organization Profile & Company Information (Admin Only) */}
                {effectiveUser.role === 'Admin' && (
                  <div className="space-y-3 pt-2">
                    <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                      <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider font-mono text-indigo-400">
                        <Building2 className="w-4 h-4 text-indigo-400" />
                        <span>Registered Organization & Company Profile</span>
                      </div>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-indigo-600/20 text-indigo-300 border border-indigo-500/30 font-bold">
                        Admin Only
                      </span>
                    </div>

                    <div className="p-4 rounded-2xl bg-gradient-to-br from-indigo-950/40 via-slate-900 to-slate-900 border border-indigo-500/30 space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-stretch">
                        <div className="md:col-span-2 space-y-3 flex flex-col justify-between">
                          <div className="space-y-1.5">
                            <label className="block text-xs font-bold text-slate-200">
                              Registered Organization / Company Name
                            </label>
                            <input
                              type="text"
                              required
                              value={companyName}
                              onChange={(e) => {
                                const val = e.target.value;
                                setCompanyName(val);
                                if (!jdCompanyName || jdCompanyName === companyName) setJdCompanyName(val);
                                if (!confirmationCompanyName || confirmationCompanyName === companyName) setConfirmationCompanyName(val);
                                if (!appointmentCompanyName || appointmentCompanyName === companyName) setAppointmentCompanyName(val);
                              }}
                              placeholder="e.g. Rheivatech Global, Apex Logistics Ltd"
                              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-indigo-500/50 text-xs font-bold text-white outline-none focus:border-indigo-400 shadow-inner"
                            />
                          </div>

                          <div className="space-y-1.5">
                            <div className="flex items-center justify-between">
                              <label className="block text-xs font-bold text-slate-200 flex items-center gap-1.5">
                                <Lock className="w-3.5 h-3.5 text-indigo-400" />
                                <span>Company Initials / Network ID</span>
                              </label>
                              <span className="text-[10px] font-mono text-indigo-400 uppercase font-bold px-2 py-0.5 rounded bg-indigo-950/60 border border-indigo-800/60">
                                Immutable Network Key
                              </span>
                            </div>
                            <div className="relative">
                              <input
                                type="text"
                                disabled
                                readOnly
                                value={companyId}
                                className="w-full pl-3.5 pr-20 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs font-mono font-bold text-indigo-300 cursor-not-allowed opacity-90 select-all"
                              />
                              <div className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center gap-1 text-[10px] font-mono text-slate-400 bg-slate-800 px-2 py-0.5 rounded">
                                <Lock className="w-3 h-3 text-slate-400" />
                                <span>LOCKED</span>
                              </div>
                            </div>
                            <p className="text-[10px] text-slate-400 leading-normal">
                              Unique ID used to scope the company network in the cloud database. Staff IDs format as <strong className="text-white font-mono">{companyId || 'CID'}/XXXX</strong>.
                            </p>
                          </div>
                        </div>

                        {/* Redesigned Clean Full-Square Logo Upload Area */}
                        <div className="h-full min-h-[140px] flex flex-col">
                          <input
                            type="file"
                            ref={logoInputRef}
                            accept="image/*"
                            onChange={handleLogoUpload}
                            className="hidden"
                          />
                          {companyLogo ? (
                            <div className="relative group w-full h-full min-h-[140px] rounded-2xl bg-white p-3 flex items-center justify-center border-2 border-slate-700 shadow-md overflow-hidden">
                              <img
                                src={companyLogo}
                                alt="Company Logo"
                                className="max-w-full max-h-full object-contain"
                              />
                              <div className="absolute inset-0 bg-slate-950/85 backdrop-blur-xs text-white opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center gap-1.5 transition-all duration-200">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    removeCentralCompanyLogo(companyId || currentUser?.companyId || currentUser?.company);
                                    setCompanyLogo(undefined);
                                    setJdLogo(undefined);
                                    setConfirmationLogo(undefined);
                                    setAppointmentLogo(undefined);
                                  }}
                                  className="p-2.5 rounded-full bg-rose-600 hover:bg-rose-500 text-white shadow-lg transition cursor-pointer hover:scale-110"
                                  title="Delete Logo"
                                >
                                  <Trash2 className="w-5 h-5" />
                                </button>
                                <span className="text-[10px] font-bold text-rose-300">Delete Logo</span>
                              </div>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => logoInputRef.current?.click()}
                              className="w-full h-full min-h-[140px] rounded-2xl bg-slate-950/80 hover:bg-slate-900 border-2 border-dashed border-indigo-500/40 hover:border-indigo-400 flex flex-col items-center justify-center p-4 text-center group transition cursor-pointer"
                            >
                              <div className="w-9 h-9 rounded-full bg-indigo-600/20 group-hover:bg-indigo-600 text-indigo-400 group-hover:text-white flex items-center justify-center border border-indigo-500/30 transition-all mb-2">
                                <Plus className="w-5 h-5" />
                              </div>
                              <span className="text-xs font-bold text-slate-200 group-hover:text-white">
                                Official Letterhead / Logo
                              </span>
                              <span className="text-[10px] text-slate-400 font-mono mt-0.5">
                                Click to upload (PNG, JPG, SVG)
                              </span>
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* 1. Theme & Interface Appearance */}
                <div className="space-y-3 pt-2">
                  <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider font-mono text-blue-400 border-b border-slate-800 pb-2">
                    <Sun className="w-4 h-4 text-amber-400" />
                    <span>Theme & Interface Appearance</span>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setTheme('dark')}
                      className={`p-3.5 rounded-2xl border text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                        theme === 'dark'
                          ? 'bg-blue-600/20 border-blue-500 text-blue-300 shadow-md shadow-blue-600/20'
                          : 'bg-slate-800/80 border-slate-700 text-slate-400 hover:bg-slate-700'
                      }`}
                    >
                      <Moon className="w-4 h-4 text-blue-400" />
                      <span>Dark Mode (High Contrast)</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setTheme('light')}
                      className={`p-3.5 rounded-2xl border text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                        theme === 'light'
                          ? 'bg-amber-500/20 border-amber-500 text-amber-500 shadow-md shadow-amber-500/20'
                          : 'bg-slate-800/80 border-slate-700 text-slate-400 hover:bg-slate-700'
                      }`}
                    >
                      <Sun className="w-4 h-4 text-amber-500" />
                      <span>Light / Clean Mode</span>
                    </button>
                  </div>
                </div>

                {/* Document Templates & Letter Customization */}
                <div className="space-y-3 pt-3 border-t border-slate-800">
                  <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider font-mono text-teal-400 border-b border-slate-800 pb-2">
                    <Briefcase className="w-4 h-4 text-teal-400" />
                    <span>Staff Document Templates & Letter Customization</span>
                  </div>
                  <div className="p-4 rounded-2xl bg-slate-800/80 border border-slate-700/80 space-y-3">
                    <div className="space-y-1">
                      <h4 className="text-xs font-bold text-white">Fully Customizable Document Templates</h4>
                      <p className="text-[11px] text-slate-400 leading-relaxed">
                        Customize sections, clauses, dynamic tags, tables, and signature blocks for official Job Descriptions, Confirmation Letters, Appointment Letters, and Performance Appraisals.
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2.5 pt-1">
                      <button
                        type="button"
                        onClick={() => setIsEditingJdFormat(true)}
                        className="px-3.5 py-2 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-bold text-xs flex items-center gap-2 transition shadow-md shadow-teal-600/20 cursor-pointer"
                      >
                        <FileText className="w-4 h-4 text-teal-100" />
                        <span>Edit JD Template</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setIsEditingConfirmationFormat(true)}
                        className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs flex items-center gap-2 transition shadow-md shadow-blue-600/20 cursor-pointer"
                      >
                        <FileCheck className="w-4 h-4 text-blue-100" />
                        <span>Edit Confirmation Letter</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setIsEditingAppointmentFormat(true)}
                        className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs flex items-center gap-2 transition shadow-md shadow-indigo-600/20 cursor-pointer"
                      >
                        <Award className="w-4 h-4 text-indigo-100" />
                        <span>Edit Appointment Letter</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setIsEditingAppraisalFormat(true)}
                        className="px-3.5 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs flex items-center gap-2 transition shadow-md shadow-amber-600/20 cursor-pointer"
                      >
                        <Target className="w-4 h-4 text-amber-100" />
                        <span>Edit Appraisal & KPI Template</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setIsEditingOfferLetterFormat(true)}
                        className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-2 transition shadow-md shadow-emerald-600/20 cursor-pointer"
                      >
                        <Sparkles className="w-4 h-4 text-emerald-100" />
                        <span>Edit Offer Letter Template</span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* 2. DYNAMIC SHIFT SCHEDULES & TIME CONFIGURATION */}
                <div className="space-y-4 pt-4 border-t border-slate-800">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                    <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider font-mono text-blue-400">
                      <Clock className="w-4 h-4 text-blue-400" />
                      <span>Shift Schedules & Time Configuration ({shifts.length} Shifts)</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setIsSavingPreset(true)}
                        className="px-2.5 py-1.5 rounded-lg bg-indigo-600/30 hover:bg-indigo-600/50 text-indigo-300 border border-indigo-500/40 text-xs font-bold flex items-center gap-1 cursor-pointer transition"
                        title="Save current shift configuration as preset"
                      >
                        <BookmarkPlus className="w-3.5 h-3.5" />
                        <span>Save Preset</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setIsAddingShift(true)}
                        className="px-2.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold flex items-center gap-1 cursor-pointer shadow-md shadow-blue-600/30 transition"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>+ New Shift</span>
                      </button>
                    </div>
                  </div>

                  <p className="text-[11px] text-slate-400">
                    Click any shift card button below to inspect and configure its resumption time, closing time, grace tolerance, and lateness cutoffs.
                  </p>

                  {/* Shift Selection Button Cards Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                    {shifts.map((shift, idx) => {
                      const isDynamicShift =
                        shift.name.toLowerCase().includes('dynamic') || shift.id === 'shift-dynamic-default';
                      const isSelected = (selectedShiftId || shifts[0]?.id) === shift.id;

                      return (
                        <button
                          key={shift.id}
                          type="button"
                          onClick={() => {
                            setSelectedShiftId(shift.id);
                            setIsAddingShift(false);
                          }}
                          className={`p-3 rounded-2xl border text-left transition-all cursor-pointer relative flex flex-col justify-between gap-2.5 ${
                            isSelected
                              ? 'bg-blue-600/15 border-blue-500 ring-2 ring-blue-500/50 shadow-lg shadow-blue-500/15'
                              : 'bg-slate-800/80 border-slate-700/80 hover:bg-slate-800 hover:border-slate-600'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="font-bold text-xs text-white truncate flex items-center gap-1.5">
                              <span className="text-[10px] font-mono text-slate-400">#{idx + 1}</span>
                              <span className="truncate">{shift.name}</span>
                            </div>
                            {idx === 0 && (
                              <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-blue-500/20 text-blue-300 border border-blue-500/30 uppercase shrink-0">
                                Primary
                              </span>
                            )}
                          </div>

                          <div className="flex items-center justify-between text-[11px] font-mono">
                            <span className={isDynamicShift ? 'text-teal-300 font-bold' : 'text-slate-300'}>
                              {isDynamicShift ? 'Auto Dynamic' : `${shift.startTime} - ${shift.endTime}`}
                            </span>
                            <span className="text-[10px] text-slate-400">
                              {shift.gracePeriodMinutes}m grace
                            </span>
                          </div>

                          {isSelected && (
                            <div className="absolute top-2 right-2 w-2 h-2 rounded-full bg-blue-400 shadow-sm shadow-blue-400" />
                          )}
                        </button>
                      );
                    })}

                    {/* Create New Shift Trigger Button */}
                    <button
                      type="button"
                      onClick={() => setIsAddingShift(true)}
                      className="p-3 rounded-2xl border border-dashed border-slate-700 hover:border-blue-500 bg-slate-900/40 hover:bg-blue-950/20 text-slate-400 hover:text-blue-300 text-xs font-bold flex flex-col items-center justify-center gap-1 transition cursor-pointer min-h-[76px]"
                    >
                      <Plus className="w-4 h-4 text-blue-400" />
                      <span>+ Add New Shift</span>
                    </button>
                  </div>

                  {/* Active Selected Shift Time & Lateness Inspector */}
                  {(() => {
                    const activeShift = shifts.find((s) => s.id === selectedShiftId) || shifts[0];
                    if (!activeShift || isAddingShift) return null;
                    const isDynamicShift =
                      activeShift.name.toLowerCase().includes('dynamic') || activeShift.id === 'shift-dynamic-default';

                    return (
                      <div
                        className={`p-4 sm:p-5 rounded-2xl border space-y-4 transition-all ${
                          isDynamicShift
                            ? 'bg-gradient-to-r from-teal-950/40 via-slate-900 to-slate-900 border-teal-500/40'
                            : 'bg-slate-900/90 border-slate-700 shadow-xl'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-3 pb-3 border-b border-slate-800">
                          <div className="flex items-center gap-2.5">
                            <div className="p-2 rounded-xl bg-blue-600/20 text-blue-400 border border-blue-500/30">
                              <Clock className="w-4 h-4" />
                            </div>
                            <div>
                              <div className="text-xs font-bold text-white flex items-center gap-2">
                                <span>Configuring: {activeShift.name}</span>
                                {isDynamicShift && (
                                  <span className="px-2 py-0.5 rounded text-[9px] font-mono font-bold bg-teal-500/20 text-teal-300 border border-teal-500/40 uppercase">
                                    Dynamic Scheme
                                  </span>
                                )}
                              </div>
                              <p className="text-[10px] text-slate-400 font-mono">
                                Set start time, closing time, grace tolerance, and lateness cutoffs.
                              </p>
                            </div>
                          </div>

                          {!isDynamicShift && shifts.length > 1 && (
                            <button
                              type="button"
                              onClick={() => handleDeleteShift(activeShift.id)}
                              className="px-2.5 py-1.5 rounded-xl bg-rose-950/40 hover:bg-rose-950/80 text-rose-300 border border-rose-800/60 text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
                              title="Delete this shift"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              <span>Delete Shift</span>
                            </button>
                          )}
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                          <div className="sm:col-span-3">
                            <label className="block text-[11px] font-bold text-slate-300 mb-1">
                              Shift Display Name
                            </label>
                            <input
                              type="text"
                              value={activeShift.name}
                              disabled={isDynamicShift}
                              onChange={(e) => handleUpdateShift(activeShift.id, 'name', e.target.value)}
                              placeholder="Shift Name (e.g. Morning Shift)"
                              className={`w-full px-3 py-2 rounded-xl border text-xs font-bold outline-none ${
                                isDynamicShift
                                  ? 'bg-teal-950/60 border-teal-500/50 text-teal-300 cursor-not-allowed'
                                  : 'bg-slate-950 border-slate-700 text-white focus:border-blue-500'
                              }`}
                            />
                          </div>

                          <div>
                            <label className="block text-[11px] font-mono font-bold text-slate-300 mb-1 flex items-center gap-1">
                              <Clock className="w-3.5 h-3.5 text-blue-400" />
                              <span>Resumption / Start Time</span>
                            </label>
                            {isDynamicShift ? (
                              <div className="px-3 py-2 rounded-xl bg-slate-950/80 border border-teal-500/30 text-teal-300 font-mono text-xs font-semibold flex items-center justify-between">
                                <span className="truncate">Auto (Dynamic Staff Shift)</span>
                                <span className="px-1.5 py-0.5 rounded bg-teal-500/20 text-teal-300 text-[9px] shrink-0">AUTO</span>
                              </div>
                            ) : (
                              <input
                                type="time"
                                value={activeShift.startTime}
                                onChange={(e) =>
                                  handleUpdateShift(activeShift.id, 'startTime', e.target.value)
                                }
                                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white font-mono text-xs font-bold outline-none focus:border-blue-500"
                              />
                            )}
                          </div>

                          <div>
                            <label className="block text-[11px] font-mono font-bold text-slate-300 mb-1 flex items-center gap-1">
                              <Clock className="w-3.5 h-3.5 text-indigo-400" />
                              <span>Closing / End Time</span>
                            </label>
                            {isDynamicShift ? (
                              <div className="px-3 py-2 rounded-xl bg-slate-950/80 border border-teal-500/30 text-teal-300 font-mono text-xs font-semibold flex items-center justify-between">
                                <span className="truncate">Auto (Dynamic Staff Closing)</span>
                                <span className="px-1.5 py-0.5 rounded bg-teal-500/20 text-teal-300 text-[9px] shrink-0">AUTO</span>
                              </div>
                            ) : (
                              <input
                                type="time"
                                value={activeShift.endTime}
                                onChange={(e) =>
                                  handleUpdateShift(activeShift.id, 'endTime', e.target.value)
                                }
                                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white font-mono text-xs font-bold outline-none focus:border-blue-500"
                              />
                            )}
                          </div>

                          <div>
                            <label className="block text-[11px] font-mono font-bold text-teal-400 mb-1 flex items-center justify-between">
                              <span>Grace Tolerance</span>
                              {isDynamicShift && <span className="text-[9px] text-teal-300 font-normal">Active Tolerance</span>}
                            </label>
                            <select
                              value={activeShift.gracePeriodMinutes}
                              onChange={(e) =>
                                handleUpdateShift(activeShift.id, 'gracePeriodMinutes', Number(e.target.value))
                              }
                              className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-teal-500/50 text-teal-200 font-mono text-xs font-bold outline-none focus:ring-2 focus:ring-teal-500/50"
                            >
                              <option value={5}>5 Mins Grace</option>
                              <option value={10}>10 Mins Grace</option>
                              <option value={15}>15 Mins Grace</option>
                              <option value={20}>20 Mins Grace</option>
                              <option value={30}>30 Mins Grace</option>
                              <option value={45}>45 Mins Grace</option>
                              <option value={60}>60 Mins Grace</option>
                            </select>
                          </div>
                        </div>

                        {/* Live Lateness Calculation Explanation */}
                        <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 text-[11px] font-mono text-slate-300 flex items-center gap-2.5">
                          <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
                          <span>
                            {isDynamicShift ? (
                              'Dynamic scheme: Staff are marked "Late" when clock-in exceeds their assigned custom shift schedule start + tolerance threshold.'
                            ) : (
                              <>
                                Resumption at <strong className="text-white">{activeShift.startTime}</strong> with <strong className="text-teal-300">{activeShift.gracePeriodMinutes}m grace</strong>. Clock-ins after <strong className="text-amber-300 font-bold">{calculateCutoffTime(activeShift.startTime, activeShift.gracePeriodMinutes)}</strong> will be automatically classified as <strong className="text-rose-400 font-bold">Late</strong>.
                              </>
                            )}
                          </span>
                        </div>
                      </div>
                    );
                  })()}

                  {/* Add New Shift Inline Form */}
                  {isAddingShift && (
                    <div className="p-4 rounded-2xl bg-blue-950/40 border border-blue-500/40 space-y-3">
                      <div className="text-xs font-bold text-blue-300 flex items-center justify-between">
                        <span>Create New Dynamic Shift Schedule</span>
                        <button
                          type="button"
                          onClick={() => setIsAddingShift(false)}
                          className="text-slate-400 hover:text-white text-xs cursor-pointer"
                        >
                          Cancel
                        </button>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                        <div className="sm:col-span-1">
                          <label className="block text-[10px] text-slate-300 mb-1">Shift Name *</label>
                          <input
                            type="text"
                            placeholder="e.g. Afternoon Shift"
                            value={newShiftName}
                            onChange={(e) => setNewShiftName(e.target.value)}
                            className="w-full px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] text-slate-300 mb-1">Start Time</label>
                          <input
                            type="time"
                            value={newShiftStart}
                            onChange={(e) => setNewShiftStart(e.target.value)}
                            className="w-full px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs font-mono text-white"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] text-slate-300 mb-1">End Time</label>
                          <input
                            type="time"
                            value={newShiftEnd}
                            onChange={(e) => setNewShiftEnd(e.target.value)}
                            className="w-full px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs font-mono text-white"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] text-slate-300 mb-1">Grace Tolerance</label>
                          <select
                            value={newShiftGrace}
                            onChange={(e) => setNewShiftGrace(Number(e.target.value))}
                            className="w-full px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs font-mono text-white"
                          >
                            <option value={5}>5 Mins</option>
                            <option value={10}>10 Mins</option>
                            <option value={15}>15 Mins</option>
                            <option value={20}>20 Mins</option>
                          </select>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={handleCreateShift}
                        className="w-full py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-md shadow-blue-600/30 cursor-pointer"
                      >
                        <Check className="w-4 h-4" />
                        <span>Save & Select Shift</span>
                      </button>
                    </div>
                  )}

                  {/* Saved Shift Presets List */}
                  {savedPresets.length > 0 && (
                    <div className="pt-2 space-y-2">
                      <div className="text-[11px] font-bold text-slate-400 font-mono uppercase tracking-wider">
                        Saved Shift Presets (Restore Configuration)
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {savedPresets.map((preset) => (
                          <div
                            key={preset.id}
                            className="p-3 rounded-xl bg-slate-800/60 border border-slate-700/80 flex items-center justify-between text-xs"
                          >
                            <div>
                              <div className="font-bold text-white">{preset.presetName}</div>
                              <div className="text-[10px] text-slate-400 font-mono">
                                {preset.shifts.length} shift(s): {preset.shifts.map((s) => s.name).join(', ')}
                              </div>
                            </div>

                            <button
                              type="button"
                              onClick={() => handleLoadPreset(preset)}
                              className="px-2.5 py-1 rounded-lg bg-blue-600/20 hover:bg-blue-600/40 text-blue-300 border border-blue-500/30 text-[11px] font-bold cursor-pointer transition shrink-0"
                            >
                              Load Preset
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* 3. AUTO-SYNC STAFF DIRECTORY FROM ATTENDANCE UPLOADS */}
                <div className="space-y-3 pt-4 border-t border-slate-800">
                  <div className="flex items-center justify-between p-4 rounded-2xl bg-slate-800/80 border border-slate-700">
                    <div className="space-y-1 max-w-md">
                      <div className="flex items-center gap-2 text-xs font-bold text-white">
                        <FolderSync className="w-4 h-4 text-teal-400" />
                        <span>Auto-Sync Staff List with Attendance Sheet Uploads</span>
                      </div>
                      <p className="text-[11px] text-slate-400 leading-relaxed">
                        When enabled, uploading an attendance worksheet automatically extracts staff names and departments to populate the staff directory. Turn off if you prefer managing the staff roster independently.
                      </p>
                    </div>

                    <label className="relative inline-flex items-center cursor-pointer shrink-0">
                      <input
                        type="checkbox"
                        checked={autoSyncStaff}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setShowSyncConfirmModal(true);
                          } else {
                            setAutoSyncStaff(false);
                          }
                        }}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-teal-500"></div>
                    </label>
                  </div>
                </div>

                {/* 4. Calendar Intelligence Note */}
                <div className="space-y-3 pt-4 border-t border-slate-800">
                  <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider font-mono text-blue-400 border-b border-slate-800 pb-2">
                    <CalendarDays className="w-4 h-4 text-indigo-400" />
                    <span>Calendar & Weekend Intelligence</span>
                  </div>
                  <div className="p-4 rounded-2xl bg-gradient-to-r from-blue-950/60 via-indigo-950/40 to-slate-900 border border-blue-500/30 text-blue-200 space-y-2">
                    <div className="flex items-center gap-2 font-mono text-xs font-bold text-blue-400">
                      <Sparkles className="w-4 h-4 text-blue-400" />
                      <span>Schedule Analysis Note ({weekendInfo.monthName} {weekendInfo.year})</span>
                    </div>
                    <p className="text-xs text-slate-300 leading-relaxed">
                      There are <strong className="text-white font-mono">{weekendInfo.totalWeekends} weekend days</strong> in this month: specifically <strong className="text-blue-300 font-mono">{weekendInfo.saturdays} Saturdays</strong> and <strong className="text-indigo-300 font-mono">{weekendInfo.sundays} Sundays</strong> out of total {weekendInfo.totalDays} days. Shift calculation policies auto-exclude these standard weekend days unless weekend overtime is explicitly checked.
                    </p>
                  </div>
                </div>

                {/* 5. Attendance Sheets Extra Columns & Custom Fields */}
                <div className="space-y-3 pt-4 border-t border-slate-800">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                    <div>
                      <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider font-mono text-blue-400">
                        <Sliders className="w-4 h-4 text-blue-400" />
                        <span>Attendance Sheets Extra Columns ({columns.length} Custom Fields)</span>
                      </div>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        These extra fields are dynamically synced with all attendance files and matrix sheets.
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {columns.length > 0 && (
                        <button
                          type="button"
                          onClick={() => setColumns([])}
                          className="px-2.5 py-1.5 rounded-lg bg-rose-600/20 hover:bg-rose-600/40 text-rose-300 text-xs font-semibold border border-rose-500/30 flex items-center gap-1 transition-colors cursor-pointer"
                          title="Delete all extra columns"
                        >
                          <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                          <span>Clear All</span>
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={handleAddColumn}
                        className="px-3 py-1.5 rounded-lg bg-blue-600/30 hover:bg-blue-600/50 text-blue-300 text-xs font-bold border border-blue-500/40 flex items-center gap-1 transition-colors cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        Add Field
                      </button>
                    </div>
                  </div>

                  {columns.length === 0 ? (
                    <div className="py-4 px-3 text-center border border-dashed border-slate-800 rounded-xl bg-slate-900/40">
                      <p className="text-xs text-slate-400">No extra custom columns configured.</p>
                      <p className="text-[11px] text-slate-500 mt-1">Attendance worksheets will generate with standard core attendance columns only.</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-48 overflow-y-auto p-1">
                      {columns.map((col, idx) => (
                        <div key={idx} className="flex items-center gap-2">
                          <span className="text-[11px] font-mono text-slate-500 w-5">{idx + 1}.</span>
                          <input
                            type="text"
                            value={col}
                            onChange={(e) => handleUpdateColumn(idx, e.target.value)}
                            className="flex-1 px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-white text-xs font-mono outline-none focus:border-blue-500"
                          />
                          <button
                            type="button"
                            onClick={() => handleRemoveColumn(idx)}
                            className="p-1.5 rounded-lg bg-slate-800 hover:bg-red-950 text-slate-400 hover:text-red-400 border border-slate-700 hover:border-red-800 transition-colors"
                            title="Delete column"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Organizational Data Backup & Database JSON Export / Restore */}
                <div className="space-y-3 pt-4 border-t border-slate-800">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                    <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider font-mono text-indigo-400">
                      <FolderArchive className="w-4 h-4 text-indigo-400" />
                      <span>Encrypted Database Backup & Universal Restore</span>
                    </div>
                    <span className="text-[11px] font-mono text-teal-400 bg-teal-950/60 border border-teal-800/60 px-2 py-0.5 rounded-md">
                      AES-GCM-256 Vault Protected
                    </span>
                  </div>

                  <div className="p-5 rounded-2xl bg-indigo-950/30 border border-indigo-900/60 flex flex-col gap-4">
                    {/* Full-width header & write-up spanning till the end of the section */}
                    <div className="space-y-1.5 w-full">
                      <h4 className="text-xs font-bold text-indigo-200">Export Portable Encrypted Database</h4>
                      <p className="text-[11px] text-slate-400 leading-relaxed w-full">
                        Exports your entire organizational database (staff directory, departments, attendance records, leaves, dynamic shifts, feeding matrix, settings, and staff logs) into a secure, password-protected encrypted archive. Company identifiers are stripped so the backup can be smoothly restored under any organization name or new account with your one-time export password.
                      </p>
                    </div>

                    {/* Action buttons sitting side-by-side underneath the writeup div */}
                    <div className="flex flex-wrap items-center gap-3">
                      <button
                        type="button"
                        disabled={isExportingBackup}
                        onClick={handleInitiateExport}
                        className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/30 transition cursor-pointer"
                        title="Export password-encrypted database archive"
                      >
                        <FolderArchive className="w-4 h-4" />
                        <span>{isExportingBackup ? 'Encrypting & Packaging...' : 'Download Database (.zip)'}</span>
                      </button>

                      <label
                        className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs flex items-center justify-center gap-2 border border-slate-700 transition cursor-pointer"
                        title="Restore encrypted or legacy database archive"
                      >
                        <Upload className="w-4 h-4 text-teal-400" />
                        <span>Restore Backup</span>
                        <input
                          type="file"
                          accept=".zip,.json,.skm"
                          onChange={handleUploadDatabaseBackup}
                          className="hidden"
                        />
                      </label>
                    </div>

                    {/* Information about confirmation of export / status messages under the buttons */}
                    {(consensusNotice || uploadBackupStatus) && (
                      <div className="space-y-2 pt-2 border-t border-indigo-900/40">
                        {consensusNotice && (
                          <div className="p-2.5 rounded-xl bg-blue-950/60 text-blue-300 border border-blue-500/40 text-xs font-mono font-semibold flex items-center gap-2">
                            <AlertCircle className="w-4 h-4 text-blue-400 shrink-0" />
                            <span>{consensusNotice}</span>
                          </div>
                        )}

                        {uploadBackupStatus && (
                          <div
                            className={`p-2.5 rounded-xl text-xs font-mono font-semibold flex items-center gap-2 ${
                              uploadBackupStatus.success
                                ? 'bg-emerald-950/60 text-emerald-300 border border-emerald-500/40'
                                : 'bg-rose-950/60 text-rose-300 border border-rose-500/40'
                            }`}
                          >
                            {uploadBackupStatus.success ? (
                              <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                            ) : (
                              <X className="w-4 h-4 text-rose-400 shrink-0" />
                            )}
                            <span>{uploadBackupStatus.message}</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Export Consensus Approval Card */}
                  {consensusRequest && (consensusRequest.status === 'pending' || consensusRequest.status === 'approved') && (
                    <div
                      className={`p-4 rounded-2xl border transition-all ${
                        consensusRequest.status === 'approved'
                          ? 'bg-emerald-950/30 border-emerald-500/40 text-emerald-200'
                          : 'bg-amber-950/30 border-amber-500/40 text-amber-200'
                      }`}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/10 pb-3">
                        <div className="flex items-center gap-2.5">
                          <div
                            className={`p-2 rounded-xl ${
                              consensusRequest.status === 'approved'
                                ? 'bg-emerald-500/20 text-emerald-400'
                                : 'bg-amber-500/20 text-amber-400'
                            }`}
                          >
                            <Users className="w-4 h-4" />
                          </div>
                          <div>
                            <h4 className="text-xs font-bold">
                              {consensusRequest.status === 'approved'
                                ? 'Export Request Approved by Consensus'
                                : 'Database Export Request Pending Consensus'}
                            </h4>
                            <p className="text-[11px] text-slate-300">
                              <strong className="text-white">{consensusRequest.requesterName}</strong> wants to export the database. Do you want to accept?
                            </p>
                          </div>
                        </div>

                        {/* Status Pills */}
                        <div className="flex items-center gap-2 text-[10px] font-mono">
                          <span
                            className={`px-2.5 py-1 rounded-lg border font-bold ${
                              consensusRequest.approvals.length >= consensusRequest.requiredApprovals
                                ? 'bg-emerald-900/60 border-emerald-600 text-emerald-300'
                                : 'bg-amber-900/60 border-amber-600 text-amber-300'
                            }`}
                          >
                            {consensusRequest.approvals.length} / {consensusRequest.requiredApprovals} Accepted (≥50%)
                          </span>
                          <span
                            className={`px-2.5 py-1 rounded-lg border font-bold ${
                              consensusRequest.hasAdminApproved
                                ? 'bg-emerald-900/60 border-emerald-600 text-emerald-300'
                                : 'bg-rose-900/60 border-rose-600 text-rose-300'
                            }`}
                          >
                            {consensusRequest.hasAdminApproved ? '✓ Admin Accepted' : '⏳ Awaiting Admin'}
                          </span>
                        </div>
                      </div>

                      {/* Approvals list & Voting Controls */}
                      <div className="mt-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                          <span className="text-slate-400">Approvals:</span>
                          {consensusRequest.approvals.length === 0 && (
                            <span className="text-slate-500 italic">No approvals yet</span>
                          )}
                          {consensusRequest.approvals.map((appr) => (
                            <span
                              key={appr.userId}
                              className="px-2 py-0.5 rounded-md bg-emerald-900/40 border border-emerald-600/40 text-emerald-300 font-mono text-[10px]"
                            >
                              ✓ {appr.userName} ({appr.userRole || appr.role})
                            </span>
                          ))}
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          {consensusRequest.status === 'approved' ? (
                            <button
                              type="button"
                              onClick={() => setShowExportPasswordModal(true)}
                              className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-lg shadow-emerald-600/30 transition cursor-pointer"
                            >
                              <KeyRound className="w-3.5 h-3.5" />
                              <span>Set Password & Download (.zip)</span>
                            </button>
                          ) : (
                            <>
                              {consensusRequest.approvals.some((a) => a.userId === effectiveUser.id) ? (
                                <span className="text-xs font-semibold text-emerald-400 bg-emerald-950/60 border border-emerald-600/40 px-3 py-1.5 rounded-xl">
                                  ✓ You have accepted this export
                                </span>
                              ) : (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => handleVoteConsensus(true)}
                                    className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-md transition cursor-pointer"
                                  >
                                    <ThumbsUp className="w-3.5 h-3.5" />
                                    <span>Accept Export</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleVoteConsensus(false)}
                                    className="px-3.5 py-1.5 rounded-xl bg-rose-900/50 hover:bg-rose-900 text-rose-300 font-semibold text-xs flex items-center gap-1.5 border border-rose-700/60 transition cursor-pointer"
                                  >
                                    <ThumbsDown className="w-3.5 h-3.5" />
                                    <span>Decline</span>
                                  </button>
                                </>
                              )}

                              {(effectiveUser.role === 'Admin' || consensusRequest.requesterId === effectiveUser.id) && (
                                <button
                                  type="button"
                                  onClick={handleCancelConsensus}
                                  className="px-2.5 py-1.5 text-xs text-slate-400 hover:text-slate-200 transition"
                                >
                                  Cancel
                                </button>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* 6. Organization & Team Access Control */}
                {onOpenAccessControl && (
                  <div className="space-y-3 pt-4 border-t border-slate-800">
                    <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider font-mono text-indigo-400 border-b border-slate-800 pb-2">
                      <Shield className="w-4 h-4 text-indigo-400" />
                      <span>Organization Access & User Roles</span>
                    </div>
                    <div className="p-4 rounded-2xl bg-indigo-950/30 border border-indigo-900/60 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div className="space-y-1">
                        <h4 className="text-xs font-bold text-indigo-200">Manage Team Access & Permissions</h4>
                        <p className="text-[11px] text-slate-400 leading-relaxed max-w-md">
                          Add and manage user accounts, assign Admin/Manager/Viewer roles, or reset login credentials for your workforce.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          onClose();
                          onOpenAccessControl();
                        }}
                        className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/30 transition cursor-pointer shrink-0"
                      >
                        <Shield className="w-4 h-4" />
                        <span>Open Access Control</span>
                      </button>
                    </div>
                  </div>
                )}

                {/* 7. Database & Storage Management (Admin Only) */}
                {effectiveUser.role === 'Admin' && (
                  <div className="space-y-3 pt-4 border-t border-slate-800">
                    <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider font-mono text-rose-400 border-b border-slate-800 pb-2">
                      <Trash2 className="w-4 h-4 text-rose-500" />
                      <span>Database & Storage Management</span>
                    </div>
                    <div className="p-4 rounded-2xl bg-rose-950/30 border border-rose-900/60 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div className="space-y-1">
                        <h4 className="text-xs font-bold text-rose-200">Clear All System Data</h4>
                        <p className="text-[11px] text-slate-400 leading-relaxed max-w-md">
                          Permanently wipe all database records including attendance worksheets, staff directory, leave logs, and app settings. This action cannot be undone.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setShowClearConfirmModal(true)}
                        className="px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-rose-600/30 transition cursor-pointer shrink-0"
                      >
                        <Trash2 className="w-4 h-4" />
                        <span>Clear All Data</span>
                      </button>
                    </div>
                  </div>
                )}

                {/* Actions */}
                <div className="pt-4 flex items-center justify-end gap-3 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs flex items-center gap-2 shadow-lg shadow-blue-600/30 transition-all cursor-pointer"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Save Configurations</span>
                  </button>
                </div>
              </form>
            </>
          )}

          {/* Modal for Turn On Sync Confirmation */}
          {showSyncConfirmModal && (
            <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/85 backdrop-blur-md p-4">
              <div className="bg-slate-900 border border-amber-500/40 rounded-3xl p-6 max-w-md w-full space-y-5 shadow-2xl">
                <div className="flex items-center gap-3 text-amber-400 font-bold text-base">
                  <div className="p-2.5 rounded-xl bg-amber-500/20 border border-amber-500/30">
                    <FolderSync className="w-6 h-6" />
                  </div>
                  <span>Turn On Auto-Sync Feature?</span>
                </div>

                <div className="p-4 rounded-2xl bg-amber-950/40 border border-amber-500/30 text-amber-200 text-xs leading-relaxed space-y-2">
                  <p className="font-bold">Are you sure? This might permanently delete documentation of some of your staff.</p>
                  <p className="text-[11px] text-slate-300">
                    Enabling auto-sync will automatically synchronize and replace the staff directory with employees present in uploaded attendance sheets.
                  </p>
                </div>

                <div className="flex items-center justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setShowSyncConfirmModal(false);
                      setAutoSyncStaff(false);
                    }}
                    className="px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowSyncConfirmModal(false);
                      setAutoSyncStaff(true);
                    }}
                    className="px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-amber-600 hover:bg-amber-500 shadow-lg shadow-amber-600/30"
                  >
                    Yes, Enable Auto-Sync
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Modal for Clear All Confirmation */}
          {showClearConfirmModal && (
            <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/85 backdrop-blur-md p-4">
              <div className="bg-slate-900 border border-rose-500/40 rounded-3xl p-6 max-w-md w-full space-y-5 shadow-2xl">
                <div className="flex items-center gap-3 text-rose-400 font-bold text-base">
                  <div className="p-2.5 rounded-xl bg-rose-500/20 border border-rose-500/30">
                    <Trash2 className="w-6 h-6" />
                  </div>
                  <span>Wipe All System Records?</span>
                </div>

                <p className="text-slate-300 text-xs leading-relaxed">
                  This action is permanent and cannot be undone. All staff rosters, attendance logs, and uploaded files will be completely deleted from local storage.
                </p>

                <div className="flex items-center justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowClearConfirmModal(false)}
                    className="px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowClearConfirmModal(false);
                      if (onClearAllData) onClearAllData();
                      onClose();
                    }}
                    className="px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-rose-600 hover:bg-rose-500 shadow-lg shadow-rose-600/30"
                  >
                    Yes, Wipe All Data
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Save Preset Dialog */}
          {isSavingPreset && (
            <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/85 backdrop-blur-md p-4">
              <div className="bg-slate-900 border border-indigo-500/40 rounded-3xl p-6 max-w-md w-full space-y-4 shadow-2xl">
                <div className="text-sm font-bold text-indigo-300 flex items-center gap-2">
                  <BookmarkPlus className="w-5 h-5" />
                  <span>Save Shift Configuration as Preset</span>
                </div>

                <div className="space-y-1">
                  <label className="block text-[11px] font-semibold text-slate-300">Preset Name</label>
                  <input
                    type="text"
                    placeholder="e.g. Standard 3-Shift Rotation"
                    value={presetNameInput}
                    onChange={(e) => setPresetNameInput(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs outline-none focus:border-indigo-500"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsSavingPreset(false)}
                    className="px-3.5 py-1.5 rounded-lg bg-slate-800 text-slate-300 text-xs font-semibold"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveCurrentAsPreset}
                    className="px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-md shadow-indigo-600/30"
                  >
                    Save Preset
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Export One-Time Password Encryption Modal */}
          <ExportPasswordModal
            isOpen={showExportPasswordModal}
            onClose={() => setShowExportPasswordModal(false)}
            onConfirmExport={handleConfirmExportWithPassword}
            isExporting={isExportingBackup}
            companyName={companyName}
          />

          {/* Restore Password Decryption Modal */}
          <RestorePasswordModal
            isOpen={showRestorePasswordModal}
            onClose={() => {
              setShowRestorePasswordModal(false);
              setSelectedRestoreFile(null);
            }}
            fileName={selectedRestoreFile?.name || 'database_archive.zip'}
            onConfirmRestore={handleConfirmRestoreWithPassword}
            isRestoring={isRestoringBackup}
            errorMessage={restoreErrorMessage}
          />
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
