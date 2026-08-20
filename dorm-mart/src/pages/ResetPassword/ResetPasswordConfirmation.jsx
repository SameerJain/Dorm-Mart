import PasswordConfirmationPage from "./components/PasswordConfirmationPage";

function ResetPasswordConfirmation() {
  return (
    <PasswordConfirmationPage
      columnPadding="p-4 sm:p-6 md:p-8"
      centerButton
    >
      <p className="text-base sm:text-lg text-white/90 text-center leading-relaxed mb-8 sm:mb-10">
        If an account using the email does not already exist, a temporary
        password has been sent to the email.
      </p>
    </PasswordConfirmationPage>
  );
}

export default ResetPasswordConfirmation;
