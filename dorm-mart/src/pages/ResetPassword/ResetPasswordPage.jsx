import { useSearchParams } from "react-router-dom";
import ResetPasswordError from "./ResetPasswordError";

function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');

  // For this feature branch, we don't implement password reset functionality
  // Just show appropriate error pages based on token status
  
  if (!token) {
    return <ResetPasswordError errorType="invalid" />;
  }

  // For now, show expired error since we're not implementing reset functionality in this branch
  return <ResetPasswordError errorType="expired" />;
}

export default ResetPasswordPage;
