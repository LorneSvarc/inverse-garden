import { useCallback, useRef } from 'react';

interface TimelineControlsProps {
  currentTime: Date;
  earliest: Date;
  latest: Date;
  isPlaying: boolean;
  playbackSpeed: number;
  visibleCount: number;
  totalCount: number;
  onTimeChange: (time: Date) => void;
  onPlayPause: () => void;
  onSpeedChange: (speed: number) => void;
}

/**
 * Timeline controls for scrubbing through mood data
 *
 * Features:
 * - Slider to scrub through time range
 * - Play/pause button for auto-advance
 * - Speed control (0.5x, 1x, 2x, 5x)
 * - Current date display
 * - Visible/total plant count
 */
export default function TimelineControls({
  currentTime,
  earliest,
  latest,
  isPlaying,
  playbackSpeed,
  visibleCount,
  totalCount,
  onTimeChange,
  onPlayPause,
  onSpeedChange,
}: TimelineControlsProps) {
  const sliderRef = useRef<HTMLInputElement>(null);

  // Convert date range to slider values (0-1000 for precision)
  const totalMs = latest.getTime() - earliest.getTime();
  const currentMs = currentTime.getTime() - earliest.getTime();
  const sliderValue = totalMs > 0 ? (currentMs / totalMs) * 1000 : 0;

  // Handle slider change
  const handleSliderChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = parseInt(e.target.value, 10);
      const newMs = (value / 1000) * totalMs;
      const newTime = new Date(earliest.getTime() + newMs);
      onTimeChange(newTime);
    },
    [earliest, totalMs, onTimeChange]
  );

  // Format date for display
  const formatDate = (date: Date): string => {
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  // Speed options
  const speedOptions = [0.5, 1, 2, 5];

  return (
    <div className="timeline-controls">
      <div className="timeline-row">
        {/* Play/Pause button */}
        <button
          className="play-button"
          onClick={onPlayPause}
          title={isPlaying ? 'Pause' : 'Play'}
        >
          {isPlaying ? '⏸' : '▶'}
        </button>

        {/* Speed selector */}
        <div className="speed-selector">
          {speedOptions.map((speed) => (
            <button
              key={speed}
              className={`speed-button ${playbackSpeed === speed ? 'active' : ''}`}
              onClick={() => onSpeedChange(speed)}
            >
              {speed}x
            </button>
          ))}
        </div>

        {/* Timeline slider */}
        <div className="slider-container">
          <input
            ref={sliderRef}
            type="range"
            min="0"
            max="1000"
            value={Math.round(sliderValue)}
            onChange={handleSliderChange}
            className="timeline-slider"
          />
          <div className="slider-labels">
            <span className="date-label start">{formatDate(earliest)}</span>
            <span className="date-label end">{formatDate(latest)}</span>
          </div>
        </div>

        {/* Current date display */}
        <div className="current-date">
          <span className="date-value">{formatDate(currentTime)}</span>
          <span className="plant-count">
            {visibleCount} / {totalCount} plants
          </span>
        </div>
      </div>
    </div>
  );
}
