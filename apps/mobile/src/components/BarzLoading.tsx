import BarzMark from './BarzMark';
import PulsingView from './PulsingView';

export default function BarzLoading() {
  return (
    <PulsingView duration={800} scaleTo={1.1} style={{ opacity: 0.3 }}>
      <BarzMark width={80} height={76} />
    </PulsingView>
  );
}
