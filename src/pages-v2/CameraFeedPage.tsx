/**
 * Camera Feed Page
 *
 * Full-screen view of live camera feeds with occupancy overlays
 */

import CameraFeedPanel from '@/components/vision/CameraFeedPanel';

export default function CameraFeedPage() {
  return (
    <div className="h-screen w-screen overflow-hidden bg-gray-900">
      <CameraFeedPanel />
    </div>
  );
}
