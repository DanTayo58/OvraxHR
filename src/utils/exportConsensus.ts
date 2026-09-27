/**
 * Multi-User Export Consensus & Approval System
 *
 * Implements organization-level export consensus:
 * - Requires at least 50% of the company's active user accounts to approve.
 * - MUST include at least one Admin approval.
 * - Allows users to view pending requests: "[Username] wants to export the database, do you want to accept?"
 */

import { User } from '../types';
import { loadCompanyData, saveCompanyData } from './companyStorage';
import { getUsersByCompany, CompanyUserAccount } from './userManagement';

const EXPORT_REQUEST_STORAGE_KEY = 'skima_export_consensus_request';

export interface ExportApprovalVote {
  userId: string;
  userName: string;
  userEmail: string;
  role: string;
  userRole?: string;
  isAdmin: boolean;
  approvedAt: string;
}

export interface ExportRejectionVote {
  userId: string;
  userName: string;
  userEmail: string;
  role: string;
  rejectedAt: string;
}

export interface ExportConsensusRequest {
  id: string;
  companyId: string;
  requesterId: string;
  requesterName: string;
  requesterEmail: string;
  requesterRole: string;
  createdAt: string;
  status: 'pending' | 'approved' | 'rejected' | 'completed' | 'cancelled';
  totalCompanyUsers: number;
  requiredApprovals: number;
  hasAdminApproved: boolean;
  approvals: ExportApprovalVote[];
  rejections: ExportRejectionVote[];
}

/**
 * Calculates whether the consensus criteria (>= 50% user approvals AND at least one Admin approval) are met.
 */
export function evaluateConsensus(
  approvals: ExportApprovalVote[],
  totalCompanyUsers: number
): { isApproved: boolean; requiredCount: number; hasAdmin: boolean } {
  const safeTotal = Math.max(1, totalCompanyUsers);
  const requiredCount = Math.max(1, Math.ceil(safeTotal * 0.5));
  const hasAdmin = approvals.some((a) => a.role === 'Admin' || a.isAdmin === true);
  const isApproved = approvals.length >= requiredCount && hasAdmin;

  return {
    isApproved,
    requiredCount,
    hasAdmin,
  };
}

/**
 * Retrieves the currently active export consensus request for a given company.
 */
export function getActiveExportRequest(companyId: string): ExportConsensusRequest | null {
  try {
    const request = loadCompanyData<ExportConsensusRequest | null>(
      EXPORT_REQUEST_STORAGE_KEY,
      companyId,
      null
    );

    if (!request) return null;

    // If request was completed or cancelled more than 30 minutes ago, discard it
    if (request.status === 'completed' || request.status === 'cancelled' || request.status === 'rejected') {
      const createdTime = new Date(request.createdAt).getTime();
      if (Date.now() - createdTime > 30 * 60 * 1000) {
        saveCompanyData(EXPORT_REQUEST_STORAGE_KEY, null, companyId);
        return null;
      }
    }

    return request;
  } catch (err) {
    console.error('Failed to load export consensus request:', err);
    return null;
  }
}

/**
 * Creates a new export request initiated by the current user.
 */
export function createExportRequest(
  user: User,
  companyId: string,
  companyName?: string
): ExportConsensusRequest {
  const companyUsers = getUsersByCompany(companyId || companyName || '');
  const totalUsers = Math.max(1, companyUsers.length);
  const requiredApprovals = Math.max(1, Math.ceil(totalUsers * 0.5));

  const isUserAdmin = user.role === 'Admin' || (user as any).isAdmin === true;

  // Requester automatically approves their own request
  const initialApproval: ExportApprovalVote = {
    userId: user.id || 'usr-current',
    userName: user.name || user.email.split('@')[0],
    userEmail: user.email,
    role: user.role || 'Staff',
    isAdmin: isUserAdmin,
    approvedAt: new Date().toISOString(),
  };

  const { isApproved, hasAdmin } = evaluateConsensus([initialApproval], totalUsers);

  const newRequest: ExportConsensusRequest = {
    id: `req-exp-${Date.now()}`,
    companyId,
    requesterId: user.id || 'usr-current',
    requesterName: user.name || user.email.split('@')[0],
    requesterEmail: user.email,
    requesterRole: user.role || 'Staff',
    createdAt: new Date().toISOString(),
    status: isApproved ? 'approved' : 'pending',
    totalCompanyUsers: totalUsers,
    requiredApprovals,
    hasAdminApproved: hasAdmin,
    approvals: [initialApproval],
    rejections: [],
  };

  saveCompanyData(EXPORT_REQUEST_STORAGE_KEY, newRequest, companyId);
  return newRequest;
}

/**
 * Records an approval or rejection vote by a user for the pending request.
 */
export function voteOnExportRequest(
  requestId: string,
  user: User,
  companyId: string,
  approve: boolean,
  companyName?: string
): { request: ExportConsensusRequest | null; isApproved: boolean } {
  const currentRequest = getActiveExportRequest(companyId);
  if (!currentRequest || currentRequest.id !== requestId) {
    return { request: null, isApproved: false };
  }

  const userId = user.id || 'usr-current';
  const isUserAdmin = user.role === 'Admin' || (user as any).isAdmin === true;

  // Filter out any prior votes from this user to prevent double voting
  const filteredApprovals = currentRequest.approvals.filter((a) => a.userId !== userId && a.userEmail !== user.email);
  const filteredRejections = currentRequest.rejections.filter((r) => r.userId !== userId && r.userEmail !== user.email);

  if (approve) {
    filteredApprovals.push({
      userId,
      userName: user.name || user.email.split('@')[0],
      userEmail: user.email,
      role: user.role || 'Staff',
      isAdmin: isUserAdmin,
      approvedAt: new Date().toISOString(),
    });
  } else {
    filteredRejections.push({
      userId,
      userName: user.name || user.email.split('@')[0],
      userEmail: user.email,
      role: user.role || 'Staff',
      rejectedAt: new Date().toISOString(),
    });
  }

  const companyUsers = getUsersByCompany(companyId || companyName || '');
  const totalUsers = Math.max(1, companyUsers.length);
  const { isApproved, requiredCount, hasAdmin } = evaluateConsensus(filteredApprovals, totalUsers);

  // If rejections prevent reaching 50% (rejections > total - requiredCount)
  const isRejected = filteredRejections.length > totalUsers - requiredCount;

  const updatedRequest: ExportConsensusRequest = {
    ...currentRequest,
    totalCompanyUsers: totalUsers,
    requiredApprovals: requiredCount,
    hasAdminApproved: hasAdmin,
    approvals: filteredApprovals,
    rejections: filteredRejections,
    status: isApproved ? 'approved' : isRejected ? 'rejected' : 'pending',
  };

  saveCompanyData(EXPORT_REQUEST_STORAGE_KEY, updatedRequest, companyId);
  return { request: updatedRequest, isApproved };
}

/**
 * Cancels the pending export request.
 */
export function cancelExportRequest(companyId: string): void {
  const current = getActiveExportRequest(companyId);
  if (current) {
    saveCompanyData(
      EXPORT_REQUEST_STORAGE_KEY,
      { ...current, status: 'cancelled' },
      companyId
    );
  }
}

/**
 * Marks the export request as completed after the file is successfully encrypted and downloaded.
 */
export function completeExportRequest(companyId: string): void {
  const current = getActiveExportRequest(companyId);
  if (current) {
    saveCompanyData(
      EXPORT_REQUEST_STORAGE_KEY,
      { ...current, status: 'completed' },
      companyId
    );
  }
}
