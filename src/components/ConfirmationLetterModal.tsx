import React from 'react';
import { StaffDocumentModal, DocumentTypeTab } from './StaffDocumentModal';
import { StaffMember, AppSettings } from '../types';

interface ConfirmationLetterModalProps {
  isOpen: boolean;
  onClose: () => void;
  staff: StaffMember | null;
  settings?: AppSettings;
  isNewStaffPrompt?: boolean;
  initialTab?: DocumentTypeTab | null;
  onFinish?: () => void;
}

export const ConfirmationLetterModal: React.FC<ConfirmationLetterModalProps> = ({
  isOpen,
  onClose,
  staff,
  settings,
  isNewStaffPrompt = false,
  initialTab = 'confirmation',
  onFinish,
}) => {
  return (
    <StaffDocumentModal
      isOpen={isOpen}
      onClose={onClose}
      staff={staff}
      settings={settings}
      isNewStaffPrompt={isNewStaffPrompt}
      initialTab={initialTab}
      onFinish={onFinish}
    />
  );
};
