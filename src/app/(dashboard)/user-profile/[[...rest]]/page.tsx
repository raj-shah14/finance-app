import { UserProfile } from "@clerk/nextjs";

export default function UserProfilePage() {
  return (
    <div className="flex justify-center py-6">
      <UserProfile path="/user-profile" />
    </div>
  );
}
