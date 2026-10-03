import React, { useState, useRef } from 'react';
import { Box, Stack, Text } from '../layout/Primitives';

export const NetworkSection = ({
  nodeCount,
  edgeCount,
  onLoadSample,
  onClearCanvas,
  onImportCSV,
  isRunning,
}) => {
  const [hoverSample, setHoverSample] = useState(false);
  const [hoverClear, setHoverClear]   = useState(false);
  const [hoverCSV, setHoverCSV]       = useState(false);
  const [csvError, setCsvError]       = useState('');
  const fileInputRef = useRef(null);

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setCsvError('');

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const text = evt.target.result;
        const lines = text.trim().split('\n').filter(Boolean);

        // Accept header line: id,demand,timeStart,timeEnd  OR  lat,lng,demand,timeStart,timeEnd
        // Skip first line if it contains letters
        const dataLines = /[a-zA-Z]/.test(lines[0]) ? lines.slice(1) : lines;

        const nodes = dataLines.map((line, i) => {
          const cols = line.split(',').map((c) => c.trim());
          if (cols.length < 1) throw new Error(`Row ${i + 2}: too few columns`);

          // Two supported formats:
          // Format A: demand, timeStart, timeEnd          (3 cols)
          // Format B: lat, lng, demand, timeStart, timeEnd (5 cols — for map import)
          if (cols.length >= 5 && !isNaN(cols[0]) && !isNaN(cols[1])) {
            // Format B
            const [lat, lng, demand, twS, twE] = cols.map(Number);
            return { lat, lng, demand: demand || 10, timeWindow: [twS ?? 0, twE ?? 90] };
          } else {
            // Format A
            const [demand, twS, twE] = [Number(cols[0]) || 10, Number(cols[1] ?? 0), Number(cols[2] ?? 90)];
            return { demand, timeWindow: [twS, twE] };
          }
        });

        onImportCSV(nodes);
      } catch (err) {
        setCsvError(err.message || 'Invalid CSV');
      }
    };
    reader.readAsText(file);
    // Reset so same file can be re-imported
    e.target.value = '';
  };

  return (
    <Box style={{ marginBottom: '24px' }}>
      <Text
        variant="label"
        size="11px"
        color="var(--muted)"
        style={{ display: 'block', marginBottom: '8px' }}
      >
        Network
      </Text>

      <Stack gap="6px" style={{ marginBottom: '12px' }}>
        <Stack direction="row" justify="space-between" align="center">
          <Text variant="body" size="13px" color="var(--muted)">Nodes in graph</Text>
          <Text variant="mono" size="14px" color="var(--text)">{nodeCount}</Text>
        </Stack>
        <Stack direction="row" justify="space-between" align="center">
          <Text variant="body" size="13px" color="var(--muted)">Edges in graph</Text>
          <Text variant="mono" size="14px" color="var(--text)">{edgeCount}</Text>
        </Stack>
      </Stack>

      <Stack gap="6px">
        {/* Load sample */}
        <button
          type="button"
          onClick={onLoadSample}
          disabled={isRunning}
          onMouseEnter={() => setHoverSample(true)}
          onMouseLeave={() => setHoverSample(false)}
          style={{
            background: 'none', border: 'none', padding: 0, textAlign: 'left',
            color: isRunning ? 'var(--muted)' : 'var(--accent)',
            fontFamily: 'var(--font-body)', fontSize: '13px',
            cursor: isRunning ? 'not-allowed' : 'pointer',
            textDecoration: hoverSample && !isRunning ? 'underline' : 'none',
            display: 'inline-block',
          }}
        >
          [ Load Sample Network ]
        </button>

        {/* Import CSV */}
        <button
          type="button"
          onClick={() => !isRunning && fileInputRef.current?.click()}
          disabled={isRunning}
          onMouseEnter={() => setHoverCSV(true)}
          onMouseLeave={() => setHoverCSV(false)}
          style={{
            background: 'none', border: 'none', padding: 0, textAlign: 'left',
            color: isRunning ? 'var(--muted)' : 'var(--accent)',
            fontFamily: 'var(--font-body)', fontSize: '13px',
            cursor: isRunning ? 'not-allowed' : 'pointer',
            textDecoration: hoverCSV && !isRunning ? 'underline' : 'none',
            display: 'inline-block',
          }}
        >
          [ Import CSV ]
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,.txt"
          style={{ display: 'none' }}
          onChange={handleFileChange}
        />

        {/* CSV format hint */}
        <Text variant="mono" size="10px" color="var(--muted)" style={{ lineHeight: 1.4 }}>
          CSV: demand, twStart, twEnd
          <br />or: lat, lng, demand, twStart, twEnd
        </Text>

        {/* CSV error */}
        {csvError && (
          <Text variant="mono" size="10px" color="var(--alert)" style={{ display: 'block' }}>
            ⚠ {csvError}
          </Text>
        )}

        {/* Clear */}
        <button
          type="button"
          onClick={onClearCanvas}
          disabled={isRunning}
          onMouseEnter={() => setHoverClear(true)}
          onMouseLeave={() => setHoverClear(false)}
          style={{
            background: 'none', border: 'none', padding: 0, textAlign: 'left',
            color: 'var(--muted)',
            fontFamily: 'var(--font-body)', fontSize: '13px',
            cursor: isRunning ? 'not-allowed' : 'pointer',
            textDecoration: hoverClear && !isRunning ? 'underline' : 'none',
            display: 'inline-block',
          }}
        >
          [ Clear Canvas ]
        </button>
      </Stack>
    </Box>
  );
};
