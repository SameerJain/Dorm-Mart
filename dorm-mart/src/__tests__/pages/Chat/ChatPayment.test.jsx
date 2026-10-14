import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import { ChatContext } from "../../../context/ChatContext";
import ChatPage from "../../../pages/Chat/ChatPage";
import { csrfPostJson } from "../../../utils/apiClient";

jest.mock("../../../utils/apiClient", () => ({ csrfPostJson: jest.fn() }));
jest.mock("react-router-dom", () => ({
  useNavigate: () => jest.fn(), useLocation: () => ({}),
  useSearchParams: () => [new URLSearchParams(), jest.fn()],
}), { virtual: true });
jest.mock("../../../pages/Chat/components/ChatSidebar", () => () => null);
jest.mock("../../../pages/Chat/components/MessageList", () => () => null);
jest.mock("../../../pages/Chat/hooks/useChatTypingStatus", () => () => ({ handleDraftChange: jest.fn(), flushTypingOnSend: jest.fn() }));
jest.mock("../../../pages/Chat/hooks/useChatUsernames", () => () => ({ handleProfileHeaderClick: jest.fn() }));
jest.mock("../../../pages/Chat/hooks/useChatConversationStatus", () => () => ({
  paymentStatus: { available: true, can_pay: true, is_mock: true, payment_option: "stripe", scheduled_request_id: 9, window_state: "open", payment_amount_cents: 500 },
  checkPaymentStatus: jest.fn(), checkActiveScheduledPurchase: jest.fn(), checkConfirmStatus: jest.fn(),
}));

test("the buyer can open and complete mock checkout from the actual chat page", async () => {
  window.scrollTo = jest.fn();
  window.matchMedia = jest.fn(() => ({ matches: true }));
  const fetchConversation = jest.fn();
  const context = {
    conversations: [{ conv_id: 3, productId: 7, productSellerId: 1, receiverId: 1, receiverName: "Demo Seller", productStatus: "Pending" }],
    activeConvId: 3, messages: [], messagesByConv: {}, typingStatusByConv: {}, unreadMsgByConv: {}, myId: 2,
    fetchConversation,
  };
  csrfPostJson.mockResolvedValueOnce({ data: { is_mock: true, amount_cents: 500 } });
  csrfPostJson.mockResolvedValueOnce({ data: { completed: true } });
  render(<ChatContext.Provider value={context}><ChatPage /></ChatContext.Provider>);
  fireEvent.click(screen.getByRole("button", { name: "Make a mock payment" }));
  fireEvent.click(await screen.findByRole("button", { name: "Complete mock transaction" }));
  await waitFor(() => expect(fetchConversation).toHaveBeenCalledWith(3));
  expect(await screen.findByText(/mock transaction completed/i)).toBeInTheDocument();
});
