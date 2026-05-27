import { create } from 'zustand';

export interface BillRequest {
  id: string;
  orderId: string;
  tableId: string;
  tableNumber?: number;
  paymentMethod: 'online' | 'card';
  items?: Array<{ name: string; quantity: number; price: number }>;
  subtotal?: number;
  total?: number;
  createdAt: string;
  status: 'pending' | 'approved' | 'declined';
}

interface BillRequestState {
  pendingRequests: BillRequest[];
  addRequest: (req: BillRequest) => void;
  approveRequest: (orderId: string) => BillRequest | undefined;
  dismissRequest: (orderId: string) => void;
}

export const useBillRequestStore = create<BillRequestState>((set, get) => ({
  pendingRequests: [],

  addRequest: (req) => {
    set((state) => {
      if (state.pendingRequests.some((r) => r.orderId === req.orderId)) return state;
      return { pendingRequests: [req, ...state.pendingRequests] };
    });
  },

  approveRequest: (orderId) => {
    const req = get().pendingRequests.find((r) => r.orderId === orderId);
    set((state) => ({
      pendingRequests: state.pendingRequests.filter((r) => r.orderId !== orderId),
    }));
    return req;
  },

  dismissRequest: (orderId) => {
    set((state) => ({
      pendingRequests: state.pendingRequests.filter((r) => r.orderId !== orderId),
    }));
  },
}));
