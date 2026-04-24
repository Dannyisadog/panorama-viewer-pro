import { PanoramaViewer } from '@/components/PanoramaViewer';

// A sample equirectangular panorama (Pannellum's default preview)
const SAMPLE_PANORAMA =
  'https://pannellum.org/images/alma.jpg';

function App() {
  return (
    <div style={{ width: '100vw', height: '100vh' }}>
      <PanoramaViewer imageUrl={SAMPLE_PANORAMA} />
    </div>
  );
}

export default App;
