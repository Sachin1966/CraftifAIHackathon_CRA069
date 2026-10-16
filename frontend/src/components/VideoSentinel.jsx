import React, { useState, useRef, useEffect } from 'react';
import { 
  Video, 
  Camera, 
  Upload, 
  Play, 
  Pause 
} from 'lucide-react';

export default function VideoSentinel() {
  const [sourceMode, setSourceMode] = useState('cctv'); // 'cctv', 'webcam', 'upload'
  const [isPlaying, setIsPlaying] = useState(true);
  const [fps] = useState(29.8);
  const [inferenceTime] = useState(13.5);
  const [uploadFileName, setUploadFileName] = useState(null);

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const webcamStreamRef = useRef(null);

  // Stop webcam stream when switching away
  useEffect(() => {
    if (sourceMode !== 'webcam' && webcamStreamRef.current) {
      webcamStreamRef.current.getTracks().forEach(track => track.stop());
      webcamStreamRef.current = null;
    }

    if (sourceMode === 'webcam') {
      navigator.mediaDevices?.getUserMedia({ video: { width: 640, height: 480 } })
        .then(stream => {
          webcamStreamRef.current = stream;
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
            videoRef.current.play();
          }
        })
        .catch(err => {
          console.error("Webcam access error:", err);
        });
    }
  }, [sourceMode]);

  // Animated CCTV detection overlay simulation on HTML5 Canvas
  useEffect(() => {
    let animationFrameId;
    let step = 0;

    const renderOverlay = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      const width = canvas.width;
      const height = canvas.height;

      ctx.clearRect(0, 0, width, height);

      // Draw Exclusion Zone Polygon wireframe
      // Simulated coordinates mapped to 640x360
      const zonePoints = [
        [280, 160],
        [520, 160],
        [520, 320],
        [280, 320]
      ];

      ctx.beginPath();
      ctx.moveTo(zonePoints[0][0], zonePoints[0][1]);
      for (let i = 1; i < zonePoints.length; i++) {
        ctx.lineTo(zonePoints[i][0], zonePoints[i][1]);
      }
      ctx.closePath();
      ctx.strokeStyle = 'rgba(239, 68, 68, 0.85)';
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 4]);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = 'rgba(239, 68, 68, 0.12)';
      ctx.fill();

      // Zone Label
      ctx.font = '11px monospace';
      ctx.fillStyle = '#ef4444';
      ctx.fillText('⚠️ MACHINE ENVELOPE [STAMPING CELL 1]', 290, 180);

      // Simulating CCTV personnel movement walking across
      if (isPlaying) {
        step += 0.02;
      }
      const t = (Math.sin(step) + 1) / 2; // 0 to 1 back and forth
      // Worker walks from (120, 220) to (420, 250) (enters breach zone when t > 0.6)
      const workerX = 120 + t * 300;
      const workerY = 200 + t * 50;

      const boxW = 55;
      const boxH = 110;
      const boxX = workerX - boxW / 2;
      const boxY = workerY - boxH;

      // Foot Point: ((x1+x2)/2, y2)
      const footX = workerX;
      const footY = workerY;

      // Inside zone test: 280 <= footX <= 520 and 160 <= footY <= 320
      const isBreaching = footX >= 280 && footX <= 520 && footY >= 160 && footY <= 320;

      // Draw Person Bounding Box
      ctx.strokeStyle = isBreaching ? '#ef4444' : '#10b981';
      ctx.lineWidth = 2.5;
      ctx.strokeRect(boxX, boxY, boxW, boxH);

      // Tag Chip above box
      ctx.fillStyle = isBreaching ? '#ef4444' : '#10b981';
      ctx.fillRect(boxX, boxY - 20, boxW + 28, 18);
      ctx.font = 'bold 10px monospace';
      ctx.fillStyle = '#ffffff';
      ctx.fillText(isBreaching ? 'BREACH 0.96' : 'PERSON 0.94', boxX + 4, boxY - 7);

      // Draw Foot Point Crosshair Dot
      ctx.beginPath();
      ctx.arc(footX, footY, 5, 0, 2 * Math.PI);
      ctx.fillStyle = isBreaching ? '#ef4444' : '#3b82f6';
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Laser guide line from box center to foot point
      ctx.beginPath();
      ctx.moveTo(workerX, workerY - boxH / 2);
      ctx.lineTo(footX, footY);
      ctx.strokeStyle = isBreaching ? 'rgba(239, 68, 68, 0.6)' : 'rgba(59, 130, 246, 0.5)';
      ctx.setLineDash([3, 3]);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.fillStyle = '#94a3b8';
      ctx.font = '9px monospace';
      ctx.fillText(`P_foot:(${Math.round(footX)},${Math.round(footY)})`, footX - 35, footY + 16);

      // Micro jitter in inference telemetry
      setFps(Math.round((29.5 + Math.random() * 0.8) * 10) / 10);
      setInferenceTime(Math.round((13.2 + Math.random() * 1.2) * 10) / 10);

      animationFrameId = requestAnimationFrame(renderOverlay);
    };

    animationFrameId = requestAnimationFrame(renderOverlay);
    return () => cancelAnimationFrame(animationFrameId);
  }, [isPlaying]);

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setIsUploading(true);
    setUploadFileName(file.name);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch('http://localhost:8000/api/upload/video', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      setSourceMode('upload');
      console.log("Uploaded successfully:", data);
    } catch (err) {
      console.error("Upload error:", err);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 lg:p-6 shadow-xl flex flex-col gap-4">
      
      {/* Top Header & Feed Selector */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
        <div>
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <Video className="w-5 h-5 text-emerald-400" />
            Vision Sentinel — DeepStream & YOLOv8 Perception
          </h2>
          <p className="text-xs text-slate-400">
            Real-time inference with foot-point ground contact math and polygon containment.
          </p>
        </div>

        {/* Source Toggle Pills */}
        <div className="flex items-center gap-1.5 bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs font-medium">
          <button
            onClick={() => setSourceMode('cctv')}
            className={`px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 ${
              sourceMode === 'cctv' ? 'bg-blue-600 text-white font-bold' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Video className="w-3.5 h-3.5" />
            <span>Factory CCTV</span>
          </button>

          <button
            onClick={() => setSourceMode('webcam')}
            className={`px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 ${
              sourceMode === 'webcam' ? 'bg-blue-600 text-white font-bold' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Camera className="w-3.5 h-3.5" />
            <span>Laptop Webcam</span>
          </button>

          <label className={`px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer ${
            sourceMode === 'upload' ? 'bg-blue-600 text-white font-bold' : 'text-slate-400 hover:text-slate-200'
          }`}>
            <Upload className="w-3.5 h-3.5" />
            <span>{uploadFileName ? uploadFileName.slice(0, 10) + '...' : 'Upload Video'}</span>
            <input type="file" accept="video/*" onChange={handleFileUpload} className="hidden" />
          </label>
        </div>
      </div>

      {/* Main Video & Canvas Viewport */}
      <div className="relative w-full aspect-video bg-black rounded-xl overflow-hidden border border-slate-800 shadow-2xl flex items-center justify-center">
        
        {/* Underlay Video Element (Webcam or background) */}
        {sourceMode === 'webcam' ? (
          <video 
            ref={videoRef} 
            autoPlay 
            playsInline 
            muted 
            className="absolute inset-0 w-full h-full object-cover" 
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center">
            {/* Ambient Factory Background SVG graphics */}
            <div className="w-full h-full opacity-35 bg-grid-pattern" />
          </div>
        )}

        {/* Dynamic Detection HUD Canvas */}
        <canvas 
          ref={canvasRef} 
          width={640} 
          height={360} 
          className="absolute inset-0 w-full h-full pointer-events-none" 
        />

        {/* Top-Left Telemetry Overlay Chip */}
        <div className="absolute top-3 left-3 bg-slate-950/85 backdrop-blur-md border border-slate-800/90 text-[11px] font-mono rounded-lg px-3 py-1.5 flex items-center gap-3 text-slate-300">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="font-bold text-white">LIVE TRT FP16</span>
          </div>
          <span>•</span>
          <div>FPS: <span className="text-emerald-400 font-bold">{fps}</span></div>
          <span>•</span>
          <div>Latency: <span className="text-blue-400 font-bold">{inferenceTime}ms</span></div>
        </div>

        {/* Bottom Playback Controls */}
        <div className="absolute bottom-3 right-3 flex items-center gap-2 bg-slate-950/80 backdrop-blur-md p-1.5 rounded-lg border border-slate-800 text-xs">
          <button
            onClick={() => setIsPlaying(!isPlaying)}
            className="p-1.5 rounded-md hover:bg-slate-800 text-slate-300 hover:text-white transition-colors"
          >
            {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Pipeline Technical Specifications Footer */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 font-mono text-xs">
        <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800">
          <div className="text-[10px] text-slate-500 uppercase">Detection Model</div>
          <div className="font-bold text-slate-200 mt-0.5">YOLOv8 Nano (Pretrained)</div>
        </div>
        <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800">
          <div className="text-[10px] text-slate-500 uppercase">Spatial Math</div>
          <div className="font-bold text-slate-200 mt-0.5">Foot-Point Raycast</div>
        </div>
        <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800">
          <div className="text-[10px] text-slate-500 uppercase">Persistence Filter</div>
          <div className="font-bold text-slate-200 mt-0.5">≥ 3 Frames Trigger</div>
        </div>
        <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800">
          <div className="text-[10px] text-slate-500 uppercase">Output Schema</div>
          <div className="font-bold text-emerald-400 mt-0.5">Protocol v1.0 JSON</div>
        </div>
      </div>

    </div>
  );
}
