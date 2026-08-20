import { useNavigate } from "react-router-dom";
import { useBodyScrollLock } from "../../hooks/useBodyScrollLock";
import CloseFormModal from "./components/CloseFormModal";
import MeetLocationField from "./components/MeetLocationField";
import NegotiationFields from "./components/NegotiationFields";
import PaymentOption from "./components/PaymentOption";
import ScheduleDateTimeFields from "./components/ScheduleDateTimeFields";
import { useSchedulePurchaseForm } from "./hooks/useSchedulePurchaseForm";

function SchedulePurchasePage() {
  const navigate = useNavigate();
  const form = useSchedulePurchaseForm();

  useBodyScrollLock(form.closeConfirmOpen);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
            Schedule a Purchase
          </h1>
          <p className="mt-2 text-gray-600 dark:text-gray-300">
            Coordinate a meetup with this buyer. They will either accept or deny
            this meetup request.
          </p>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <form onSubmit={form.handleSubmit} className="space-y-5">
            <MeetLocationField
              customMeetLocation={form.customMeetLocation}
              meetLocationChoice={form.meetLocationChoice}
              selectedListing={form.selectedListing}
              setCustomMeetLocation={form.setCustomMeetLocation}
              setMeetLocationChoice={form.setMeetLocationChoice}
            />

            <ScheduleDateTimeFields
              dayInputRef={form.dayInputRef}
              meetingAmPm={form.meetingAmPm}
              meetingDay={form.meetingDay}
              meetingHour={form.meetingHour}
              meetingMinute={form.meetingMinute}
              meetingMonth={form.meetingMonth}
              meetingYear={form.meetingYear}
              monthInputRef={form.monthInputRef}
              setDateTimeError={form.setDateTimeError}
              setMeetingAmPm={form.setMeetingAmPm}
              setMeetingDay={form.setMeetingDay}
              setMeetingHour={form.setMeetingHour}
              setMeetingMinute={form.setMeetingMinute}
              setMeetingMonth={form.setMeetingMonth}
              setMeetingYear={form.setMeetingYear}
              yearInputRef={form.yearInputRef}
            />

            <NegotiationFields
              isTrade={form.isTrade}
              negotiatedPrice={form.negotiatedPrice}
              selectedListing={form.selectedListing}
              setIsTrade={form.setIsTrade}
              setNegotiatedPrice={form.setNegotiatedPrice}
              setTradeItemDescription={form.setTradeItemDescription}
              tradeItemDescription={form.tradeItemDescription}
            />

            <PaymentOption
              amount={form.paymentAmount}
              eligibility={form.paymentEligibility}
              isTrade={form.isTrade}
              loading={form.paymentEligibilityLoading}
              onAmountChange={form.setPaymentAmount}
              onToggle={(selected) => {
                if (selected && form.negotiatedPrice.trim()) {
                  form.setPaymentAmount(Number(form.negotiatedPrice).toFixed(2));
                }
                form.setUseBuiltInPayment(selected);
              }}
              selected={form.useBuiltInPayment}
            />

            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2">
                Description (Optional)
              </label>
              <textarea
                value={form.description}
                onChange={(e) => form.setDescription(e.target.value)}
                rows={4}
                maxLength={1000}
                placeholder="Add any additional details about the meeting..."
                className="w-full bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y"
              />
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                {form.description.length}/1000 characters
              </p>
            </div>

            {(form.formError || form.dateTimeError) && (
              <div className="mt-4 space-y-2">
                {form.formError && (
                  <div className="text-sm text-red-600 dark:text-red-400 break-words px-1">
                    {form.formError}
                  </div>
                )}
                {form.dateTimeError && (
                  <div className="text-sm text-red-600 dark:text-red-400 break-words px-1">
                    {form.dateTimeError}
                  </div>
                )}
              </div>
            )}

            <div className="pt-2 flex justify-between items-center">
              <button
                type="button"
                onClick={() => form.setCloseConfirmOpen(true)}
                className="inline-flex items-center px-4 py-2 border-2 border-red-500 text-red-600 dark:text-red-400 text-sm font-semibold rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 focus:outline-none focus:ring-2 focus:ring-red-500"
              >
                Close
              </button>
              <button
                type="submit"
                disabled={form.isSubmitting}
                className="inline-flex items-center px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg shadow hover:bg-blue-700 dark:hover:bg-blue-900 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-60"
              >
                {form.isSubmitting ? "Scheduling..." : "Schedule Purchase"}
              </button>
            </div>
          </form>
        </div>

        {form.error && (
          <div className="mt-6 text-sm text-red-600 dark:text-red-400">
            {form.error}
          </div>
        )}

        {form.closeConfirmOpen && (
          <CloseFormModal
            onClose={() => form.setCloseConfirmOpen(false)}
            onConfirm={() => navigate("/app/chat")}
          />
        )}
      </div>
    </div>
  );
}

export default SchedulePurchasePage;
