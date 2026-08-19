import PasswordConfirmationPage from "./components/PasswordConfirmationPage";

function ForgotPasswordConfirmation() {
  return (
    <PasswordConfirmationPage columnPadding="p-4 sm:p-8">
      <p className="text-base sm:text-lg text-white/90 mb-4 sm:mb-5 text-center leading-relaxed">
        If an account with this email address exists, then a link to reset your
        password was sent to your inbox!
      </p>
      <p className="text-sm sm:text-base text-white/80 text-center italic mb-6 sm:mb-8 leading-relaxed">
        Note: Another email can only be sent after 10 minutes. Please check your
        spam folder.
      </p>
    </PasswordConfirmationPage>
  );
}

export default ForgotPasswordConfirmation;
