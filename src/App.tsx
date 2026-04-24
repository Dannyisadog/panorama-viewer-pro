import { useState, useRef } from 'react';
import { PanoramaViewer } from '@/components/PanoramaViewer';

// A sample equirectangular panorama (Pannellum's default preview)
const SAMPLE_PANORAMA =
  'https://pannellum.org/images/alma.jpg';

function App() {
  const [imageUrl, setImageUrl] = useState<string>(SAMPLE_PANORAMA);
  const prevObjectUrlRef = useRef<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Revoke previous local object URL to avoid memory leaks
    if (prevObjectUrlRef.current) {
      URL.revokeObjectURL(prevObjectUrlRef.current);
    }

    const objectUrl = URL.createObjectURL(file);
    prevObjectUrlRef.current = objectUrl;
    setImageUrl(objectUrl);
  };

  return (
    <div style={{ width: '100vw', height: '100vh', position: 'relative' }}>
      {/* File input — positioned top-left, minimal styling */}
      <input
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        style={{
          position: 'absolute',
          top: 16,
          left: 16,
          zIndex: 10,
          cursor: 'pointer',
          background: 'rgba(0,0,0,0.5)',
          color: '#fff',
          border: '1px solid rgba(255,255,255,0.3)',
          borderRadius: 6,
          padding: '8px 14px',
          fontSize: 14,
        }}
      />

      <PanoramaViewer imageUrl={imageUrl} />
    </div>
  );
}

export default App;
