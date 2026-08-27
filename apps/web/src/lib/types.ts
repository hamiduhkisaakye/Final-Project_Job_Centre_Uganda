export type UserRole = 'ADMIN' | 'COMPANY' | 'JOB_SEEKER';
export type EmploymentType = 'FULL_TIME' | 'PART_TIME' | 'CONTRACT' | 'INTERNSHIP' | 'REMOTE';
export type JobStatus = 'DRAFT' | 'PENDING_REVIEW' | 'PUBLISHED' | 'PAUSED' | 'CLOSED' | 'REJECTED';
export type ApplicationStage = 'APPLIED' | 'IN_REVIEW' | 'INTERVIEW' | 'OFFER' | 'HIRED' | 'REJECTED' | 'WITHDRAWN';
export type VerificationStatus = 'UNVERIFIED' | 'PENDING' | 'VERIFIED' | 'REJECTED';
export type InterviewMode = 'VIDEO_CALL' | 'PHONE' | 'IN_PERSON';
export type InterviewStatus = 'SCHEDULED' | 'COMPLETED' | 'CANCELLED';

export interface Company {
  id: string;
  name: string;
  slug: string;
  logoUrl?: string | null;
  coverUrl?: string | null;
  industry?: string | null;
  sizeBand?: string | null;
  website?: string | null;
  about?: string | null;
  hqLocation?: string | null;
  verificationStatus: VerificationStatus;
  salaryTransparencyVerified: boolean;
  plan: 'FREE' | 'STANDARD' | 'PREMIUM';
  credits: number;
  memberRole?: 'OWNER' | 'RECRUITER' | 'VIEWER';
  jobs?: Job[];
  _count?: { jobs: number };
}

export interface Job {
  id: string;
  companyId: string;
  title: string;
  slug: string;
  description: string;
  responsibilities: string[];
  requirements: string[];
  employmentType: EmploymentType;
  seniority?: string | null;
  category: string;
  location: string;
  salaryMin?: number | null;
  salaryMax?: number | null;
  salaryCurrency: string;
  salaryPeriod: string;
  salaryDisclosed: boolean;
  salaryVerifiedAt?: string | null;
  skills: string[];
  assessmentId?: string | null;
  assessment?: Pick<Assessment, 'id' | 'title'> | null;
  status: JobStatus;
  publishedAt?: string | null;
  viewsCount: number;
  applicationsCount: number;
  createdAt: string;
  company?: Pick<Company, 'name' | 'slug' | 'logoUrl' | 'verificationStatus'> & Partial<Company>;
}

export interface SeekerProfile {
  userId: string;
  fullName?: string | null;
  avatarUrl?: string | null;
  headline?: string | null;
  about?: string | null;
  location?: string | null;
  willingToRelocate: boolean;
  yearsExperience?: number | null;
  expectedSalaryMin?: number | null;
  expectedSalaryMax?: number | null;
  currency: string;
  skills: string[];
  resumeText?: string | null;
  resumeFileUrl?: string | null;
  resumeFileName?: string | null;
  videoResumeUrl?: string | null;
  profileStrength: number;
}

export interface User {
  id: string;
  email: string;
  role: UserRole;
  status: string;
  seekerProfile?: SeekerProfile;
  company?: Company;
}

export interface Application {
  id: string;
  jobId: string;
  seekerId: string;
  coverLetter?: string | null;
  stage: ApplicationStage;
  matchScore?: number | null;
  assessmentScore?: number | null;
  assessmentPassed?: boolean | null;
  rejectionReason?: string | null;
  submittedAt: string;
  stageChangedAt: string;
  job?: Job;
  seeker?: { id: string; email: string; seekerProfile?: SeekerProfile };
}

export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  body: string;
  isSystem: boolean;
  readAt?: string | null;
  createdAt: string;
}

export type NotificationType = 'MESSAGE' | 'APPLICATION_STAGE' | 'NEW_APPLICATION' | 'JOB_MODERATION';

export interface Notification {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  link?: string | null;
  readAt?: string | null;
  createdAt: string;
}

export type BlogPostStatus = 'DRAFT' | 'PUBLISHED';

export interface BlogPost {
  id: string;
  title: string;
  slug: string;
  excerpt?: string | null;
  content: string;
  coverImageUrl?: string | null;
  status: BlogPostStatus;
  authorId: string;
  publishedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ContactMessage {
  id: string;
  name: string;
  email: string;
  message: string;
  readAt?: string | null;
  createdAt: string;
}

export interface Conversation {
  id: string;
  companyId: string;
  seekerId: string;
  // One thread per job posting, even for the same company+seeker — see
  // Conversation's @@unique in schema.prisma.
  jobId: string;
  lastMessageAt?: string | null;
  createdAt: string;
  company: Pick<Company, 'id' | 'name' | 'slug' | 'logoUrl'>;
  seeker: { id: string; email: string; seekerProfile?: SeekerProfile | null };
  job: Pick<Job, 'id' | 'title'>;
  lastMessage?: Message | null;
  unreadCount: number;
}

export interface AssessmentQuestion {
  question: string;
  options: string[];
  // Present only in the company-authored view (create/edit/list); stripped
  // from the seeker-facing GET /assessments/:id response.
  correctIndex?: number;
}

export interface Assessment {
  id: string;
  companyId: string;
  title: string;
  description?: string | null;
  questions: AssessmentQuestion[];
  passScore: number;
  createdAt: string;
  updatedAt: string;
}

export interface AssessmentAttempt {
  id: string;
  assessmentId: string;
  seekerId: string;
  answers: number[];
  score: number;
  passed: boolean;
  completedAt: string;
  assessment?: Pick<Assessment, 'id' | 'title' | 'passScore'>;
}

export interface Interview {
  id: string;
  applicationId: string;
  scheduledAt: string;
  durationMinutes: number;
  mode: InterviewMode;
  location?: string | null;
  notes?: string | null;
  status: InterviewStatus;
  createdById: string;
  createdAt: string;
  application?: {
    id: string;
    seekerId: string;
    seeker?: { id: string; email: string; seekerProfile?: SeekerProfile | null };
    job: Pick<Job, 'id' | 'title'> & { company?: Pick<Company, 'id' | 'name' | 'slug' | 'logoUrl'> };
  };
}
