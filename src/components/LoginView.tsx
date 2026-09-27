import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { User } from '../types';
import { RheivatechLogo } from './RheivatechLogo';
import {
  findUserByEmailOrUsername,
  addCompanyUser,
  loadAllCompanyUsers,
  isCompanyIdTaken,
  sendVerificationCodeApi,
  verifyCodeApi,
  markUserEmailVerified,
  resetUserPassword,
  getActiveClientVerificationCode,
  CompanyUserAccount,
} from '../utils/userManagement';
import {
  normalizeCompanyId,
  deriveCompanyIdFromName,
} from '../utils/companyStorage';
import { authenticateSuperAdmin } from '../utils/reviewsAndTickets';
import { authenticateInternalCrew, findInternalCrewByIdentifier } from '../utils/internalCrewManagement';
import {
  Lock,
  Mail,
  User as UserIcon,
  Building2,
  Eye,
  EyeOff,
  ArrowRight,
  ShieldCheck,
  AtSign,
  Fingerprint,
  CheckCircle2,
  AlertCircle,
  KeyRound,
  RefreshCw,
  ArrowLeft,
  ShieldAlert,
  Info,
  Copy,
  Check,
} from 'lucide-react';

interface LoginViewProps {
  onLoginSuccess: (user: User, isDemo?: boolean) => void;
  sessionExpiredMsg?: string | null;
  onOpenWebsite?: () => void;
}

type AuthMode = 'signin' | 'register' | 'forgot_password' | 'verify_code' | 'reset_password';
type VerificationPurpose = 'register' | 'forgot_password' | 'first_login' | 'verify_email';

export const LoginView: React.FC<LoginViewProps> = ({
  onLoginSuccess,
  sessionExpiredMsg,
  onOpenWebsite,
}) => {
  const [authMode, setAuthMode] = useState<AuthMode>('signin');
  const [verificationPurpose, setVerificationPurpose] = useState<VerificationPurpose>('verify_email');

  // Sign In & Registration form state
  const [loginIdentifier, setLoginIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [fullName, setFullName] = useState('');
  const [company, setCompany] = useState('');
  const [companyId, setCompanyId] = useState('');
  const [username, setUsername] = useState('');
  const [rememberMe, setRememberMe] = useState(true);

  // Forgot Password & Reset state
  const [forgotIdentifier, setForgotIdentifier] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);

  // Verification Code State (6 digits)
  const [codeDigits, setCodeDigits] = useState<string[]>(['', '', '', '', '', '']);
  const [targetEmail, setTargetEmail] = useState('');
  const [targetUserName, setTargetUserName] = useState('');
  const [targetCompany, setTargetCompany] = useState('');
  const [pendingUserAccount, setPendingUserAccount] = useState<CompanyUserAccount | null>(null);
  const [pendingRegistrationData, setPendingRegistrationData] = useState<any | null>(null);

  // UI state
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [demoCodeHint, setDemoCodeHint] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);

  // Digit Input Refs
  const digitRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Resend cooldown timer
  useEffect(() => {
    let timer: any;
    if (resendCooldown > 0) {
      timer = setInterval(() => {
        setResendCooldown((prev) => (prev > 0 ? prev - 1 : 0));
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [resendCooldown]);

  // Focus first digit box and ensure active code is loaded when switching to verification screen
  useEffect(() => {
    if (authMode === 'verify_code') {
      if (!demoCodeHint && targetEmail) {
        const active = getActiveClientVerificationCode(targetEmail);
        if (active) setDemoCodeHint(active);
      }
      setTimeout(() => {
        digitRefs.current[0]?.focus();
      }, 150);
    }
  }, [authMode, targetEmail, demoCodeHint]);

  // Handle Company Name change to suggest clean company initials
  const handleCompanyNameChange = (val: string) => {
    setCompany(val);
    if (!companyId || companyId === deriveCompanyIdFromName(company)) {
      setCompanyId(deriveCompanyIdFromName(val));
    }
  };

  // Handle OTP digit changes
  const handleDigitChange = (index: number, val: string) => {
    const cleanVal = val.replace(/[^0-9]/g, '');
    if (!cleanVal && val !== '') return;

    const newDigits = [...codeDigits];

    if (cleanVal.length > 1) {
      // Pasted multiple digits
      const pasted = cleanVal.slice(0, 6).split('');
      for (let i = 0; i < 6; i++) {
        newDigits[i] = pasted[i] || '';
      }
      setCodeDigits(newDigits);
      const nextIdx = Math.min(pasted.length, 5);
      digitRefs.current[nextIdx]?.focus();
      return;
    }

    newDigits[index] = cleanVal;
    setCodeDigits(newDigits);

    // Auto-advance to next box
    if (cleanVal && index < 5) {
      digitRefs.current[index + 1]?.focus();
    }
  };

  const handleDigitKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !codeDigits[index] && index > 0) {
      digitRefs.current[index - 1]?.focus();
    }
  };

  const handleDigitPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/[^0-9]/g, '').slice(0, 6);
    if (pasted) {
      const newDigits = [...codeDigits];
      for (let i = 0; i < 6; i++) {
        newDigits[i] = pasted[i] || '';
      }
      setCodeDigits(newDigits);
      const nextFocus = Math.min(pasted.length, 5);
      digitRefs.current[nextFocus]?.focus();
    }
  };

  // Trigger sending verification code via Zoho SMTP
  const initiateSendCode = async (params: {
    email: string;
    purpose: 'register' | 'forgot_password' | 'first_login_verification' | 'verify_email';
    name?: string;
    company?: string;
  }) => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await sendVerificationCodeApi(params);
      setIsLoading(false);

      if (!res.success) {
        setError(res.error || 'Failed to dispatch verification code. Please try again.');
        return false;
      }

      setResendCooldown(30); // 30s resend cooldown
      const activeCode = res.demoCode || getActiveClientVerificationCode(params.email) || null;
      setDemoCodeHint(activeCode);
      return true;
    } catch (err: any) {
      setIsLoading(false);
      setError(err?.message || 'Error communicating with email service.');
      return false;
    }
  };

  // Sign In / Register Form Submission
  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    const trimmedIdentifier = loginIdentifier.trim();
    if (!trimmedIdentifier || !password) {
      setError('Please enter your email or username, along with your password.');
      return;
    }

    if (authMode === 'register') {
      const trimmedCompany = company.trim();
      const trimmedName = fullName.trim();
      const cleanCompanyId = normalizeCompanyId(companyId);
      const trimmedUsername = username.trim().toLowerCase().replace(/[^a-z0-9_.-]/g, '');

      if (!trimmedCompany) {
        setError('Please enter your organization name.');
        return;
      }

      if (!cleanCompanyId || cleanCompanyId.length < 2) {
        setError('Please set valid Company Initials / ID (at least 2 letters or numbers, no whitespace or symbols).');
        return;
      }

      if (!/^[A-Za-z0-9]+$/.test(cleanCompanyId)) {
        setError('Company Initials / ID can only contain letters and numbers.');
        return;
      }

      if (!trimmedName) {
        setError('Please enter your full name.');
        return;
      }

      if (!trimmedIdentifier.includes('@')) {
        setError('Please provide a valid company email address for verification.');
        return;
      }

      const existingUser = findUserByEmailOrUsername(trimmedIdentifier);
      if (existingUser) {
        setError(`An account with "${trimmedIdentifier}" is already registered to "${existingUser.company}". Please sign in.`);
        return;
      }

      if (isCompanyIdTaken(cleanCompanyId, trimmedCompany)) {
        setError(`Company ID "${cleanCompanyId}" is already registered to another organization. Each company must have a strictly unique ID.`);
        return;
      }

      const regPayload = {
        email: trimmedIdentifier,
        username: trimmedUsername || trimmedIdentifier.split('@')[0].toLowerCase().replace(/[^a-z0-9_.-]/g, ''),
        name: trimmedName,
        company: trimmedCompany,
        companyId: cleanCompanyId,
        role: 'Admin',
        isAdmin: true,
        password: password,
      };

      setPendingRegistrationData(regPayload);
      setTargetEmail(trimmedIdentifier);
      setTargetUserName(trimmedName);
      setTargetCompany(trimmedCompany);
      setVerificationPurpose('register');
      setCodeDigits(['', '', '', '', '', '']);

      const sent = await initiateSendCode({
        email: trimmedIdentifier,
        purpose: 'register',
        name: trimmedName,
        company: trimmedCompany,
      });

      if (sent) {
        setAuthMode('verify_code');
      }
      return;
    }

    // SIGN IN MODE: Three-tier authentication check
    setIsLoading(true);

    // Table 1: Check Super Admin / Rheivatech Master Admin Table
    const superAdminUser = authenticateSuperAdmin(trimmedIdentifier, password);
    if (superAdminUser) {
      setIsLoading(false);
      onLoginSuccess(superAdminUser);
      return;
    }

    // Table 2: Check OvraxHR Support & Internal Crew Table (entry-rheivatech-* staff)
    if (
      trimmedIdentifier.toLowerCase().startsWith('entry-rheivatech-') ||
      Boolean(findInternalCrewByIdentifier(trimmedIdentifier))
    ) {
      const crewUser = authenticateInternalCrew(trimmedIdentifier, password);
      if (crewUser) {
        setIsLoading(false);
        onLoginSuccess(crewUser);
        return;
      }
      setError('Invalid internal crew credentials. Please verify your username and password.');
      setIsLoading(false);
      return;
    }

    // Table 3: Check Standard Organization Users Table
    const matchedUser = findUserByEmailOrUsername(trimmedIdentifier);

    if (!matchedUser) {
      setError('No registered account found for this email or username. Please check your credentials or register an organization account.');
      setIsLoading(false);
      return;
    }

    if (matchedUser.password && matchedUser.password !== password) {
      setError('Incorrect password. Please try again or use "Forgot password" to reset it.');
      setIsLoading(false);
      return;
    }

    // Check if user email requires verification (e.g. newly added by an admin)
    if (matchedUser.isEmailVerified === false) {
      setPendingUserAccount(matchedUser);
      setTargetEmail(matchedUser.email);
      setTargetUserName(matchedUser.name);
      setTargetCompany(matchedUser.company);
      setVerificationPurpose('first_login');
      setCodeDigits(['', '', '', '', '', '']);

      const sent = await initiateSendCode({
        email: matchedUser.email,
        purpose: 'first_login_verification',
        name: matchedUser.name,
        company: matchedUser.company,
      });

      setIsLoading(false);
      if (sent) {
        setAuthMode('verify_code');
      }
      return;
    }

    // Regular authenticated login
    setIsLoading(false);
    onLoginSuccess(matchedUser);
  };

  // Forgot Password Submit
  const handleForgotSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    const trimmed = forgotIdentifier.trim();
    if (!trimmed) {
      setError('Please enter your registered email address or username.');
      return;
    }

    const matchedUser = findUserByEmailOrUsername(trimmed);
    if (!matchedUser) {
      setError(`No account found for "${trimmed}". Please check your email or contact your administrator.`);
      return;
    }

    setPendingUserAccount(matchedUser);
    setTargetEmail(matchedUser.email);
    setTargetUserName(matchedUser.name);
    setTargetCompany(matchedUser.company);
    setVerificationPurpose('forgot_password');
    setCodeDigits(['', '', '', '', '', '']);

    const sent = await initiateSendCode({
      email: matchedUser.email,
      purpose: 'forgot_password',
      name: matchedUser.name,
      company: matchedUser.company,
    });

    if (sent) {
      setAuthMode('verify_code');
    }
  };

  // Verify Code Submission
  const handleVerifyCodeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    const fullCode = codeDigits.join('').trim();
    if (fullCode.length !== 6) {
      setError('Please enter the complete 6-digit verification code.');
      return;
    }

    setIsLoading(true);

    const purposeKey =
      verificationPurpose === 'register'
        ? 'register'
        : verificationPurpose === 'forgot_password'
        ? 'forgot_password'
        : 'first_login_verification';

    const verifyRes = await verifyCodeApi({
      email: targetEmail,
      code: fullCode,
      purpose: purposeKey,
    });

    setIsLoading(false);

    if (!verifyRes.success || !verifyRes.verified) {
      setError(verifyRes.error || 'Invalid or expired verification code. Please try again.');
      return;
    }

    // Code verified successfully!
    if (verificationPurpose === 'register' && pendingRegistrationData) {
      const newUser = addCompanyUser({
        ...pendingRegistrationData,
        isEmailVerified: true,
      });
      setSuccessMsg('Email verified and organization registered successfully!');
      setTimeout(() => {
        onLoginSuccess(newUser);
      }, 400);
      return;
    }

    if (verificationPurpose === 'first_login' && pendingUserAccount) {
      markUserEmailVerified(pendingUserAccount.id);
      const verifiedUser = { ...pendingUserAccount, isEmailVerified: true };
      setSuccessMsg('Email verified successfully! Welcome to Skima.');
      setTimeout(() => {
        onLoginSuccess(verifiedUser);
      }, 400);
      return;
    }

    if (verificationPurpose === 'forgot_password') {
      setAuthMode('reset_password');
      setSuccessMsg('Verification successful. Please enter your new password.');
    }
  };

  // Reset Password Submission
  const handleResetPasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!newPassword || newPassword.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match. Please re-enter your password.');
      return;
    }

    setIsLoading(true);

    setTimeout(() => {
      const success = resetUserPassword(targetEmail, newPassword);
      setIsLoading(false);

      if (success) {
        setAuthMode('signin');
        setLoginIdentifier(targetEmail);
        setPassword('');
        setSuccessMsg('Your password has been successfully reset! You can now sign in with your new password.');
      } else {
        setError('Failed to update password. Please contact your system administrator.');
      }
    }, 400);
  };

  // Resend code handler
  const handleResendCode = async () => {
    if (resendCooldown > 0 || !targetEmail) return;
    setCodeDigits(['', '', '', '', '', '']);
    setError(null);
    setSuccessMsg('A new verification code has been dispatched to your email.');

    const purposeKey =
      verificationPurpose === 'register'
        ? 'register'
        : verificationPurpose === 'forgot_password'
        ? 'forgot_password'
        : 'first_login_verification';

    await initiateSendCode({
      email: targetEmail,
      purpose: purposeKey,
      name: targetUserName,
      company: targetCompany,
    });
  };

  const handleQuickDemoLogin = () => {
    const allUsers = loadAllCompanyUsers();
    const adminUser = (allUsers || []).find((u) => u && (u.isAdmin || u.role === 'Admin')) || {
      id: 'usr-admin-001',
      email: 'admin@company.com',
      username: 'admin',
      name: 'Alex Morgan',
      company: 'Skima HQ',
      companyId: 'SKM',
      role: 'Admin',
      isAdmin: true,
      isEmailVerified: true,
    };
    onLoginSuccess(adminUser, true);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-center items-center p-4 sm:p-6 relative selection:bg-blue-600 selection:text-white">
      {/* Subtle Background Glows */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-blue-900/20 via-slate-950 to-slate-950 pointer-events-none" />
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#1e293b08_1px,transparent_1px),linear-gradient(to_bottom,#1e293b08_1px,transparent_1px)] bg-[size:24px_24px] pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="w-full max-w-[460px] relative z-10 flex flex-col items-center"
      >
        {/* Brand Header */}
        <div className="mb-6 flex flex-col items-center text-center">
          <RheivatechLogo size="xl" showSubtext animated theme="dark" />
        </div>

        {/* Inactivity Session Timeout Alert */}
        {sessionExpiredMsg && (
          <div className="w-full mb-5 p-3.5 rounded-xl bg-amber-950/60 border border-amber-800/60 text-amber-200 text-xs flex items-center gap-2.5">
            <Lock className="w-4 h-4 text-amber-400 shrink-0" />
            <span>{sessionExpiredMsg}</span>
          </div>
        )}

        {successMsg && (
          <div className="w-full mb-5 p-3.5 rounded-xl bg-emerald-950/60 border border-emerald-800/60 text-emerald-200 text-xs flex items-center gap-2.5 shadow-lg shadow-emerald-950/40">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Card Container */}
        <div className="w-full bg-slate-900/90 border border-slate-800/90 rounded-2xl p-6 sm:p-8 shadow-2xl backdrop-blur-md">
          <AnimatePresence mode="wait">
            {/* ========================================================================= */}
            {/* VIEW 1: VERIFY CODE SCREEN                                                */}
            {/* ========================================================================= */}
            {authMode === 'verify_code' && (
              <motion.div
                key="verify_code"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                transition={{ duration: 0.2 }}
                className="space-y-5"
              >
                {/* Header */}
                <div className="text-center">
                  <div className="w-12 h-12 rounded-2xl bg-blue-600/20 text-blue-400 border border-blue-500/30 flex items-center justify-center mx-auto mb-3">
                    <Mail className="w-6 h-6" />
                  </div>
                  <h1 className="text-xl font-bold tracking-tight text-white">
                    {verificationPurpose === 'first_login'
                      ? 'Verify Your Email to Continue'
                      : verificationPurpose === 'forgot_password'
                      ? 'Password Reset Code'
                      : 'Verify Your Email Address'}
                  </h1>
                  <p className="text-xs text-slate-300 mt-1.5 leading-relaxed">
                    {demoCodeHint ? (
                      <>
                        Verification code generated for <strong className="text-blue-300 font-semibold">{targetEmail}</strong>. You can use the instant code below to continue.
                      </>
                    ) : (
                      <>
                        Enter the verification code sent to your email{' '}
                        <strong className="text-blue-300 font-semibold">{targetEmail}</strong>
                      </>
                    )}
                  </p>
                </div>

                {/* Security Warning Box */}
                <div className="p-3.5 rounded-xl bg-rose-950/40 border border-rose-800/50 text-rose-200 text-xs flex items-start gap-2.5">
                  <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                  <span className="leading-relaxed">
                    <strong>Please do not share this code with anyone.</strong> Skima and Rheivatech will never ask for your verification code.
                  </span>
                </div>

                {/* Resilient In-App Verification Code Display */}
                {demoCodeHint && (
                  <div className="p-3.5 rounded-xl bg-blue-950/70 border border-blue-600/50 text-blue-100 text-xs shadow-md space-y-2.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 font-medium">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                        <span className="text-white font-semibold">Resilient Verification Code</span>
                      </div>
                      <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-full bg-blue-900/80 text-blue-300 border border-blue-500/30">
                        In-App Active
                      </span>
                    </div>

                    <div className="flex items-center justify-between gap-2 bg-slate-900/90 p-2.5 rounded-lg border border-slate-700/80">
                      <span className="font-mono text-base tracking-widest text-emerald-300 font-bold px-1">
                        {demoCodeHint}
                      </span>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard?.writeText(demoCodeHint);
                            setCopiedCode(true);
                            setTimeout(() => setCopiedCode(false), 2000);
                          }}
                          className="px-2.5 py-1 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-medium transition cursor-pointer flex items-center gap-1 border border-slate-700"
                        >
                          {copiedCode ? (
                            <>
                              <Check className="w-3 h-3 text-emerald-400" />
                              <span>Copied</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3 h-3 text-slate-400" />
                              <span>Copy</span>
                            </>
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const digits = demoCodeHint.split('');
                            setCodeDigits(digits);
                            digitRefs.current[5]?.focus();
                          }}
                          className="px-2.5 py-1 rounded-md bg-blue-600 hover:bg-blue-500 text-white text-[11px] font-semibold transition cursor-pointer shadow-xs"
                        >
                          Autofill Code
                        </button>
                      </div>
                    </div>

                    <p className="text-[11px] text-blue-200/80 leading-relaxed">
                      Use this in-app security code to verify instantly without waiting for external email servers.
                    </p>
                  </div>
                )}

                {/* OTP Input Form */}
                <form onSubmit={handleVerifyCodeSubmit} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 text-center uppercase tracking-wider mb-2 font-mono">
                      6-Digit Security Code
                    </label>
                    <div className="flex items-center justify-center gap-2 sm:gap-2.5">
                      {codeDigits.map((digit, idx) => (
                        <input
                          key={idx}
                          ref={(el) => {
                            digitRefs.current[idx] = el;
                          }}
                          type="text"
                          inputMode="numeric"
                          maxLength={1}
                          value={digit}
                          onChange={(e) => handleDigitChange(idx, e.target.value)}
                          onKeyDown={(e) => handleDigitKeyDown(idx, e)}
                          onPaste={handleDigitPaste}
                          className="w-11 h-13 sm:w-12 sm:h-14 text-center text-xl sm:text-2xl font-mono font-bold text-white bg-slate-950 border border-slate-700 rounded-xl focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30 transition shadow-inner"
                        />
                      ))}
                    </div>
                  </div>

                  {/* 10 Minute Admin Support Notice */}
                  <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 text-[11px] text-slate-400 leading-relaxed">
                    💬 <span className="text-slate-300 font-semibold">Important:</span> If you did not get an email after 10 minutes, please tell your admin to confirm your details.
                  </div>

                  {/* Error Banner */}
                  {error && (
                    <div className="p-3 rounded-xl bg-red-950/70 border border-red-800/80 text-xs text-red-300 leading-relaxed flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                      <span>{error}</span>
                    </div>
                  )}

                  {/* Verify Button */}
                  <button
                    type="submit"
                    disabled={isLoading || codeDigits.join('').length !== 6}
                    className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 disabled:opacity-50 text-white font-semibold text-sm rounded-xl transition flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-blue-600/25"
                  >
                    {isLoading ? (
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <>
                        <span>Verify & Continue</span>
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </form>

                {/* Resend & Navigation Links */}
                <div className="pt-2 flex flex-col items-center gap-3 text-xs">
                  <button
                    type="button"
                    disabled={resendCooldown > 0 || isLoading}
                    onClick={handleResendCode}
                    className="text-blue-400 hover:text-blue-300 disabled:text-slate-500 font-medium flex items-center gap-1.5 cursor-pointer disabled:cursor-not-allowed"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
                    <span>
                      {resendCooldown > 0
                        ? `Resend code in ${resendCooldown}s`
                        : 'Resend verification email'}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setAuthMode('signin');
                      setError(null);
                    }}
                    className="text-slate-400 hover:text-white flex items-center gap-1 cursor-pointer"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>Back to Sign In</span>
                  </button>
                </div>
              </motion.div>
            )}

            {/* ========================================================================= */}
            {/* VIEW 2: FORGOT PASSWORD REQUEST SCREEN                                    */}
            {/* ========================================================================= */}
            {authMode === 'forgot_password' && (
              <motion.div
                key="forgot_password"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                transition={{ duration: 0.2 }}
                className="space-y-4"
              >
                <div className="text-center mb-6">
                  <div className="w-12 h-12 rounded-2xl bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 flex items-center justify-center mx-auto mb-3">
                    <KeyRound className="w-6 h-6" />
                  </div>
                  <h1 className="text-xl font-bold tracking-tight text-white">
                    Forgot Your Password?
                  </h1>
                  <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                    Enter your registered email address or username. We will send a secure 6-digit verification code to reset your password.
                  </p>
                </div>

                <form onSubmit={handleForgotSubmit} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                      Email address or Username *
                    </label>
                    <div className="relative">
                      <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        required
                        value={forgotIdentifier}
                        onChange={(e) => {
                          setForgotIdentifier(e.target.value);
                          setError(null);
                        }}
                        placeholder="you@company.com or username"
                        className="w-full pl-10 pr-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition"
                      />
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 text-[11px] text-slate-400 leading-relaxed">
                    📧 Please check your email for the verification code sent to you by <strong className="text-slate-200">no-reply@rheivatech.space</strong>.
                  </div>

                  {error && (
                    <div className="p-3 rounded-xl bg-red-950/70 border border-red-800/80 text-xs text-red-300 leading-relaxed flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                      <span>{error}</span>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 disabled:opacity-50 text-white font-semibold text-sm rounded-xl transition flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-blue-600/25"
                  >
                    {isLoading ? (
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <>
                        <span>Send Verification Code</span>
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </form>

                <div className="pt-2 text-center">
                  <button
                    type="button"
                    onClick={() => {
                      setAuthMode('signin');
                      setError(null);
                    }}
                    className="text-xs text-slate-400 hover:text-white flex items-center justify-center gap-1 cursor-pointer mx-auto"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>Back to Sign In</span>
                  </button>
                </div>
              </motion.div>
            )}

            {/* ========================================================================= */}
            {/* VIEW 3: RESET NEW PASSWORD SCREEN                                         */}
            {/* ========================================================================= */}
            {authMode === 'reset_password' && (
              <motion.div
                key="reset_password"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                transition={{ duration: 0.2 }}
                className="space-y-4"
              >
                <div className="text-center mb-6">
                  <div className="w-12 h-12 rounded-2xl bg-emerald-600/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center mx-auto mb-3">
                    <Lock className="w-6 h-6" />
                  </div>
                  <h1 className="text-xl font-bold tracking-tight text-white">
                    Set New Password
                  </h1>
                  <p className="text-xs text-slate-400 mt-1">
                    Choose a strong password for <strong className="text-slate-200">{targetEmail}</strong>
                  </p>
                </div>

                <form onSubmit={handleResetPasswordSubmit} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                      New Password *
                    </label>
                    <div className="relative">
                      <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <input
                        type={showNewPassword ? 'text' : 'password'}
                        required
                        minLength={6}
                        value={newPassword}
                        onChange={(e) => {
                          setNewPassword(e.target.value);
                          setError(null);
                        }}
                        placeholder="••••••••"
                        className="w-full pl-10 pr-10 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition"
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewPassword(!showNewPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 cursor-pointer p-1"
                        tabIndex={-1}
                      >
                        {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                      Confirm New Password *
                    </label>
                    <div className="relative">
                      <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <input
                        type={showNewPassword ? 'text' : 'password'}
                        required
                        minLength={6}
                        value={confirmPassword}
                        onChange={(e) => {
                          setConfirmPassword(e.target.value);
                          setError(null);
                        }}
                        placeholder="••••••••"
                        className="w-full pl-10 pr-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition"
                      />
                    </div>
                  </div>

                  {error && (
                    <div className="p-3 rounded-xl bg-red-950/70 border border-red-800/80 text-xs text-red-300 leading-relaxed flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                      <span>{error}</span>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 disabled:opacity-50 text-white font-semibold text-sm rounded-xl transition flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-emerald-600/25"
                  >
                    {isLoading ? (
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <>
                        <span>Reset Password & Sign In</span>
                        <CheckCircle2 className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </form>
              </motion.div>
            )}

            {/* ========================================================================= */}
            {/* VIEW 4: SIGN IN / REGISTER FORM                                           */}
            {/* ========================================================================= */}
            {(authMode === 'signin' || authMode === 'register') && (
              <motion.div
                key={authMode}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
              >
                {/* Title */}
                <div className="mb-6 text-center">
                  <h1 className="text-xl font-bold tracking-tight text-white">
                    {authMode === 'register' ? 'Register Organization & Account' : 'Sign In'}
                  </h1>
                  <p className="text-xs text-slate-400 mt-1">
                    {authMode === 'register'
                      ? 'Create a new company network workspace and admin account'
                      : 'Enter your credentials to access your company network'}
                  </p>
                </div>

                <form onSubmit={handleAuthSubmit} className="space-y-4">
                  {/* Registration Fields */}
                  {authMode === 'register' && (
                    <>
                      <div>
                        <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                          Organization / Company Name *
                        </label>
                        <div className="relative">
                          <Building2 className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                          <input
                            type="text"
                            required
                            value={company}
                            onChange={(e) => handleCompanyNameChange(e.target.value)}
                            placeholder="e.g. Apex Global Logistics"
                            className="w-full pl-10 pr-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center justify-between">
                          <span>Company Initials / Network ID *</span>
                          <span className="text-[10px] font-mono text-indigo-400 uppercase">Letters & Numbers Only</span>
                        </label>
                        <div className="relative">
                          <Fingerprint className="w-4 h-4 text-indigo-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                          <input
                            type="text"
                            required
                            maxLength={10}
                            value={companyId}
                            onChange={(e) => {
                              const clean = e.target.value.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
                              setCompanyId(clean);
                            }}
                            placeholder="e.g. AGL, SKM, RHV01"
                            className="w-full pl-10 pr-3.5 py-2.5 bg-slate-950 border border-indigo-500/50 rounded-xl text-sm font-mono font-bold text-indigo-200 placeholder:text-slate-500 focus:outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400 transition"
                          />
                        </div>
                        <p className="text-[10px] text-slate-400 mt-1">
                          Scopes all company files and formats staff IDs as <strong className="text-slate-200 font-mono">{companyId || 'CID'}/XXXX</strong>.
                        </p>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                          Full Name *
                        </label>
                        <div className="relative">
                          <UserIcon className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                          <input
                            type="text"
                            required
                            value={fullName}
                            onChange={(e) => setFullName(e.target.value)}
                            placeholder="e.g. Alex Morgan"
                            className="w-full pl-10 pr-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center justify-between">
                          <span>Username (Optional)</span>
                          <span className="text-[11px] text-blue-400">e.g. alexm</span>
                        </label>
                        <div className="relative">
                          <AtSign className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                          <input
                            type="text"
                            value={username}
                            onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_.-]/g, ''))}
                            placeholder="username"
                            className="w-full pl-10 pr-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition"
                          />
                        </div>
                      </div>
                    </>
                  )}

                  {/* Email / Username Field */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                      {authMode === 'register' ? 'Email address (Verification Required) *' : 'Email or Username'}
                    </label>
                    <div className="relative">
                      <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <input
                        type={authMode === 'register' ? 'email' : 'text'}
                        required
                        value={loginIdentifier}
                        onChange={(e) => {
                          setLoginIdentifier(e.target.value);
                          setError(null);
                        }}
                        placeholder={authMode === 'register' ? 'admin@company.com' : 'admin@company.com or username'}
                        className="w-full pl-10 pr-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition"
                      />
                    </div>
                  </div>

                  {/* Password Field */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="block text-xs font-semibold text-slate-300">
                        Password *
                      </label>
                      {authMode === 'signin' && (
                        <button
                          type="button"
                          onClick={() => {
                            setForgotIdentifier(loginIdentifier);
                            setAuthMode('forgot_password');
                            setError(null);
                            setSuccessMsg(null);
                          }}
                          className="text-xs text-blue-400 hover:text-blue-300 hover:underline cursor-pointer"
                        >
                          Forgot password?
                        </button>
                      )}
                    </div>
                    <div className="relative">
                      <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <input
                        type={showPassword ? 'text' : 'password'}
                        required
                        value={password}
                        onChange={(e) => {
                          setPassword(e.target.value);
                          setError(null);
                        }}
                        placeholder="••••••••"
                        className="w-full pl-10 pr-10 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 cursor-pointer p-1"
                        tabIndex={-1}
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {/* Remember Me */}
                  {authMode === 'signin' && (
                    <div className="flex items-center justify-between pt-1">
                      <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-300 select-none">
                        <input
                          type="checkbox"
                          checked={rememberMe}
                          onChange={(e) => setRememberMe(e.target.checked)}
                          className="rounded border-slate-700 bg-slate-950 text-blue-600 focus:ring-blue-500 focus:ring-offset-slate-900 w-3.5 h-3.5 cursor-pointer"
                        />
                        <span>Remember me on this device</span>
                      </label>
                    </div>
                  )}

                  {/* Error Banner */}
                  {error && (
                    <div className="p-3 rounded-xl bg-red-950/70 border border-red-800/80 text-xs text-red-300 leading-relaxed flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                      <span>{error}</span>
                    </div>
                  )}

                  {/* Submit Button */}
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full mt-2 py-2.5 px-4 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 disabled:opacity-50 text-white font-semibold text-sm rounded-xl transition flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-blue-600/25"
                  >
                    {isLoading ? (
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <>
                        <span>{authMode === 'register' ? 'Register & Verify Email' : 'Sign In'}</span>
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </form>

                {/* Quick Demo Credentials */}
                <div className="mt-6 pt-5 border-t border-slate-800/80 space-y-2.5">
                  <button
                    type="button"
                    onClick={handleQuickDemoLogin}
                    className="w-full py-2 px-3 rounded-xl bg-slate-800/60 hover:bg-slate-800 border border-slate-700/60 hover:border-slate-600 text-slate-300 hover:text-white text-xs font-medium flex items-center justify-center gap-2 transition cursor-pointer"
                  >
                    <ShieldCheck className="w-4 h-4 text-blue-400" />
                    <span>Quick Demo Sign In (Demo Admin - HQ)</span>
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Footer Toggle */}
        {(authMode === 'signin' || authMode === 'register') && (
          <div className="text-center mt-6">
            <p className="text-xs text-slate-400">
              {authMode === 'register' ? 'Already have an account?' : "Don't have an account?"}{' '}
              <button
                type="button"
                onClick={() => {
                  setAuthMode(authMode === 'register' ? 'signin' : 'register');
                  setError(null);
                  setSuccessMsg(null);
                  setLoginIdentifier('');
                  setPassword('');
                  setCompany('');
                  setCompanyId('');
                  setFullName('');
                  setUsername('');
                }}
                className="text-blue-400 hover:text-blue-300 font-semibold hover:underline cursor-pointer ml-1"
              >
                {authMode === 'register' ? 'Sign in' : 'Create an organization account'}
              </button>
            </p>
          </div>
        )}

        {onOpenWebsite && (
          <div className="mt-4 text-center">
            <button
              type="button"
              onClick={onOpenWebsite}
              className="text-xs text-slate-400 hover:text-amber-300 font-mono flex items-center justify-center gap-1.5 mx-auto transition cursor-pointer"
            >
              <span>Explore OvraxHR Plans &amp; Pricing</span>
              <span className="text-amber-400">&rarr;</span>
            </button>
          </div>
        )}
      </motion.div>
    </div>
  );
};
