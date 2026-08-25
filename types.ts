
export interface ScannedDocument {
  id: string;
  name: string; // Ex: Identidade, CPF
  type: string; // Ex: image/jpeg
  url: string; // Base64
  date: string;
  tags?: string[];
  ocrText?: string;
  summary?: string;
}

export interface AgendaEvent {
  id: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:MM
  type: 'audiência' | 'perícia' | 'atendimento' | 'prazo' | 'outro';
  clientId?: string;
  clientName?: string;
  description: string;
  location?: string;
  status?: 'pending' | 'resolved' | 'cancelled';
  resolvedAt?: string;
  resolvedBy?: string;
  resolutionNote?: string;
  isVirtual?: boolean;
  gender?: 'M' | 'F';
  extraInstructions?: string;
  benefitType?: 'incapacidade' | 'bpc';
  diseaseType?: 'ortopedica' | 'psiquiatrica' | 'autismo' | 'cardiologica' | 'oncologica' | 'outra';
}

export interface Petition {
  id: string;
  title: string;
  content: string;
  category: string;
  type: 'model' | 'concrete';
  lastModified: string;
}

export interface ClientEventHistory {
  id: string;
  clientId: string;
  eventType: 'perícia_médica' | 'perícia_social' | 'audiência' | 'prorrogação' | 'dcb' | '90_dias' | 'mandado_segurança' | 'atendimento' | 'cadastro' | 'observação' | 'outro';
  title: string;
  date?: string; // Data em que o evento ocorreu ou estava agendado (ex: 21/08/2026 ou 2026-08-21)
  time?: string; // Horário (ex: 10:30)
  location?: string; // Local / Vara / Agência do INSS
  status: 'concluído' | 'remarcado' | 'pendente' | 'cancelado' | 'registrado';
  notes?: string; // "O que aconteceu" / Observações / Ata
  performedBy?: string; // Quem registrou (Dr. Michel, Dra. Luana, Fabrícia, etc.)
  createdAt: string; // ISO timestamp
}

export interface ClientRecord {
  id: string;
  name: string;
  cpf: string;
  password: string;
  nationality?: string;
  maritalStatus?: string;
  profession?: string;
  type: string;
  der: string;
  medExpertiseDate: string;
  socialExpertiseDate: string;
  extensionDate: string;
  dcbDate: string;
  ninetyDaysDate: string;
  securityMandateDate: string;
  address?: string;
  
  // Campos do Representante Legal
  legalRepresentative?: string; // Nome
  legalRepresentativeGender?: string;
  legalRepresentativeCpf?: string;
  legalRepresentativeMaritalStatus?: string;
  legalRepresentativeProfession?: string;
  legalRepresentativeAddress?: string;
  legalRepresentativeNationality?: string;
  whatsapp?: string;
  gender?: 'M' | 'F';

  isDailyAttention?: boolean;
  isUrgentAttention?: boolean;
  isArchived?: boolean;
  isReferral?: boolean;
  referrerName?: string;
  referrerPercentage?: number;
  totalFee?: number;
  documents?: ScannedDocument[];
  documentCount?: number;
  petitionCount?: number;
  narrativeCertificateCount?: number;
  petitions?: Petition[];
  narrativeCertificates?: ScannedDocument[];
  eventHistory?: ClientEventHistory[];
  createdAt?: string;
}

export enum UserRole {
  ADVOGADO = 'Advogado(a)',
  SECRETARIA = 'Secretária'
}

export interface User {
  firstName: string;
  lastName: string;
  role: UserRole;
  email?: string | null;
}

export const AUTHORIZED_USERS = [
  { firstName: 'Michel', lastName: 'Felix', role: UserRole.ADVOGADO, email: 'michel.advprev@gmail.com' },
  { firstName: 'Luana', lastName: 'Castro', role: UserRole.ADVOGADO, email: 'luanacadvogada@gmail.com' },
  { firstName: 'Fabrícia', lastName: 'Sousa', role: UserRole.SECRETARIA, email: 'fabriciasousa2025@outlook.com' },
  { firstName: 'Felix & Castro', lastName: 'Advocacia', role: UserRole.ADVOGADO, email: 'felixecastroadv@gmail.com' },
];

export interface FocusTask {
  id: string;
  title: string;
  description: string;
  type: 'alert' | 'contract' | 'postponed';
  priority: 'high' | 'medium' | 'low';
  dueDate?: string;
  clientId?: string;
  clientName?: string;
  originalAlertKey?: string;
  eventDateFormatted?: string;
  eventTime?: string;
  elapsedOrRemainingText?: string;
  serviceType?: string;
  lawyerName?: string;
  location?: string;
  categoryBadge?: string;
}

export interface TaskLogEntry {
  id: string;
  taskId: string;
  title: string;
  action: 'completed' | 'discarded' | 'postponed';
  completedAt: string;
  completedBy: string;
}

export interface DailyFocusState {
  resolvedTasks: string[];
  postponedTasks: FocusTask[];
  taskLog: TaskLogEntry[];
}

// --- NOVOS TIPOS PARA CONTRATOS ---

export interface PaymentEntry {
  id: string;
  date: string; // ISO Date YYYY-MM-DD
  dueDate: string; // ISO Date YYYY-MM-DD
  amount: number;
  isPaid: boolean;
  note?: string;
}

export interface ContractRecord {
  id: string;
  clientId?: string;
  firstName: string;
  lastName: string;
  cpf: string;
  serviceType: string;
  lawyer: 'Michel' | 'Luana';
  totalFee: number;
  status: 'Pendente' | 'Em Andamento' | 'Concluído';
  paymentMethod: 'À Vista' | 'Parcelado';
  installmentsCount?: number; // Novo campo para quantidade de parcelas
  payments: PaymentEntry[];
  createdAt: string;
  concludedAt?: string;
  lawyerSplit?: number;
}

// --- Interfaces de Componentes (Movidas do App.tsx) ---

export interface NotificationItem {
  id: string;
  clientName: string;
  type: string;
  date: string;
}

export interface ContractModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (record: ContractRecord) => void;
  initialData?: ContractRecord | null;
  clients: ClientRecord[];
}

export interface LoginProps {
  onLogin: (user: User) => void;
  onOpenSettings: () => void;
  isCloudConfigured: boolean;
}

export interface RecordModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (record: ClientRecord) => void;
  initialData?: ClientRecord | null;
  onOpenScanner?: () => void;
  onOpenPetition?: (petition: Petition, clientId?: string) => void;
  agendaEvents?: AgendaEvent[];
  user?: User;
}

export interface MonthlyDetailsModalProps {
    isOpen: boolean;
    onClose: () => void;
    year: number;
    contracts: ContractRecord[];
    type: 'revenue' | 'michel' | 'luana' | 'portfolio' | 'total_concluded' | null;
}

export interface DashboardProps {
  user: User;
  onLogout: () => void;
  darkMode: boolean;
  toggleDarkMode: () => void;
  onOpenSettings: () => void;
  isCloudConfigured: boolean;
  isSettingsOpen: boolean;
  onCloseSettings: () => void;
  onSettingsSaved: () => void;
  onRestoreBackup: () => void;
}

export interface ScannerModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (doc: ScannedDocument) => void;
}
