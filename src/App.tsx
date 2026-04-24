import { useState, useRef } from 'react';
import { PanoramaViewer } from '@/components/PanoramaViewer';
import { FloatingBar } from '@/components/FloatingBar';

const SAMPLE_PANORAMA = 'https://pannellum.org/images/alma.jpg';

function App() {
  const [imageUrl, setImageUrl] = useState<string>(SAMPLE_PANORAMA);
  const [selectedFileName, setSelectedFileName] = useState<string | undefined>();
  const prevObjectUrlRef = useRef<string | null>(null);

  const handleImageSelect = (url: string, fileName: string) => {
    // Revoke previous local object URL to avoid memory leaks
    if (prevObjectUrlRef.current?.startsWith('blob:')) {
      URL.revokeObjectURL(prevObjectUrlRef.current);
    }
    prevObjectUrlRef.current = url;
    setImageUrl(url);
    setSelectedFileName(fileName);
  };

  return (
    <div style={{ width: '100vw', height: '100vh', position: 'relative' }}>
      <PanoramaViewer imageUrl={imageUrl} />

      <FloatingBar
        onImageSelect={handleImageSelect}
        selectedFileName={selectedFileName}
      />
    </div>
  );
}

export default App;
