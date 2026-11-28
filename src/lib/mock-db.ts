// In-memory fallback database for when local MongoDB is not running.
// This guarantees 100% uptime and allows immediate testing out of the box!

export interface MockStore {
  users: any[];
  employees: any[];
  attendances: any[];
  leaves: any[];
  leaveBalances: Record<string, any>;
  payrollRuns: any[];
  payslips: any[];
  devices: any[];
  mappings: any[];
  assets: any[];
  mails: any[];
  notifications: any[];
  announcements: any[];
  auditLogs: any[];
}

const todayStr = new Date().toISOString().slice(0, 10);

function getInitialStore(): MockStore {
  return {
    users: [
      {
        _id: "u-1",
        email: process.env.SUPERADMIN_EMAIL || "superadmin@gvkedutech.com",
        name: "Super Admin",
        role: "super_admin",
        employeeId: "ADM-001",
        branch: "Headquarters",
        isActive: true,
      },
    ],
    employees: [],
    attendances: [],
    leaves: [],
    leaveBalances: {},
    payrollRuns: [],
    payslips: [],
    devices: [],
    mappings: [],
    assets: [],
    mails: [],
    notifications: [],
    announcements: [],
    auditLogs: [],
  };
}

declare global {
  // eslint-disable-next-line no-var
  var __mockStore: MockStore | undefined;
}

export function getMockStore(): MockStore {
  if (!globalThis.__mockStore) {
    globalThis.__mockStore = getInitialStore();
  }
  return globalThis.__mockStore;
}

export function resetMockStore(): MockStore {
  globalThis.__mockStore = getInitialStore();
  return globalThis.__mockStore;
}
