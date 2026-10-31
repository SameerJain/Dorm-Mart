import FAQItemList from "./FAQItemList";

const PROFILE_FAQ_ITEMS = [
  {
    question: "What information is shown on a public profile?",
    answer:
      "You'll see the person's name, username, picture, bio, active listings, and seller reviews, including their average seller rating.",
  },
  {
    question: "How do I view another user's profile?",
    answer:
      "Click the seller's name or picture on a listing or in chat to open their public profile.",
  },
  {
    question: "Can I edit my public profile from this page?",
    answer:
      "Go to Settings, then My Profile to change your picture or bio. Your name comes from sign-up and can't be edited there.",
  },
  {
    question: "Why don't I see any listings on a profile?",
    answer:
      "They may not have any active listings. Their items may have sold or been removed from the marketplace.",
  },
];

function ProfileFAQ() {
  return <FAQItemList items={PROFILE_FAQ_ITEMS} />;
}

export default ProfileFAQ;
