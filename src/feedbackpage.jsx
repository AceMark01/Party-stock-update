// src/feedbackpage.jsx - Final Mobile-First Fixed Bottom Buttons (Sticky on All Devices)

import { useState, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Star, Mic, Send, Loader2, AlertCircle, Image as ImageIcon, Video, Camera } from 'lucide-react';
import toast, { Toaster } from 'react-hot-toast';
import supabase from './supabaseClient';
import Confetti from 'react-confetti';

function FeedbackPage() {
  const [searchParams] = useSearchParams();
  const party = searchParams.get('party') || 'Unknown Party';
  const transactionKey = searchParams.get('key') || 'Unknown Key';

  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [remark, setRemark] = useState('');
  const [audioBlob, setAudioBlob] = useState(null);
  const [recording, setRecording] = useState(false);
  const [photoFile, setPhotoFile] = useState(null);
  const [videoFile, setVideoFile] = useState(null);
  const [videoRecording, setVideoRecording] = useState(false);
  const [likedOptions, setLikedOptions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const [showAdditional, setShowAdditional] = useState(false);

  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const videoRecorderRef = useRef(null);
  const videoChunksRef = useRef([]);

  const ratingLabels = ['Very Poor', 'Poor', 'Average', 'Good', 'Excellent'];
  const ratingEmojis = ['😞', '🙁', '😐', '🙂', '😍'];

  // Dynamic content based on rating
  const getRemarkTitle = () => {
    if (rating <= 2) return 'What can we improve?';
    if (rating === 3) return 'Share your thoughts';
    return 'What made this excellent?';
  };

  const getRemarkDescription = () => {
    if (rating <= 2) return 'We value your feedback to improve.';
    if (rating === 3) return 'Your balanced view helps us grow.';
    return 'Tell us what made it special!';
  };

  const getRemarkPlaceholder = () => {
    if (rating <= 2) return 'Please tell us how we can improve...';
    if (rating === 3) return 'Your suggestions matter...';
    return 'What stood out as excellent?';
  };

  const getLikedTitle = () => {
    if (rating <= 2) return 'What needs improvement?';
    if (rating === 3) return 'Areas we can enhance';
    return 'What did you love?';
  };

  const getLikedCheckboxes = () => {
    if (rating <= 2) return [
      'Better Product Quality',
      'Improved Customer Support',
      'More Reasonable Pricing',
      'Faster Delivery',
      'Wider Product Range'
    ];
    return [
      'Quality of Products',
      'Customer Service',
      'Pricing',
      'Delivery Speed',
      'Product Variety'
    ];
  };

  // Audio Recording
  const startAudioRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorderRef.current = new MediaRecorder(stream);
      audioChunksRef.current = [];

      mediaRecorderRef.current.ondataavailable = (e) => audioChunksRef.current.push(e.data);

      mediaRecorderRef.current.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        setAudioBlob(blob);
      };

      mediaRecorderRef.current.start();
      setRecording(true);
      toast('Recording started... Speak now!');
    } catch (err) {
      toast.error('Mic access denied');
    }
  };

  const stopAudioRecording = () => {
    mediaRecorderRef.current?.stop();
    setRecording(false);
    toast.success('Recording stopped!');
  };

  // Photo & Video
  const handlePhotoUpload = (e) => {
    const file = e.target.files[0];
    if (file) setPhotoFile(file);
  };

  const handleVideoUpload = (e) => {
    const file = e.target.files[0];
    if (file) setVideoFile(file);
  };

  const startVideoRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      videoRecorderRef.current = new MediaRecorder(stream);
      videoChunksRef.current = [];

      videoRecorderRef.current.ondataavailable = (e) => videoChunksRef.current.push(e.data);

      videoRecorderRef.current.onstop = () => {
        const blob = new Blob(videoChunksRef.current, { type: 'video/webm' });
        setVideoFile(blob);
      };

      videoRecorderRef.current.start();
      setVideoRecording(true);
      toast('Video recording started...');
    } catch (err) {
      toast.error('Camera access denied');
    }
  };

  const stopVideoRecording = () => {
    videoRecorderRef.current?.stop();
    setVideoRecording(false);
    toast.success('Video recording stopped!');
  };

  const toggleLiked = (option) => {
    setLikedOptions(prev => 
      prev.includes(option) ? prev.filter(o => o !== option) : [...prev, option]
    );
  };

  const handleContinue = () => {
    if (rating === 0) return toast.error('Please select a rating first');
    setShowAdditional(true);
  };

  const submitFeedback = async () => {
    if (rating === 0) return toast.error('Please select a rating');

    setLoading(true);

    let audioUrl = null, photoUrl = null, videoUrl = null;

    try {
      // Audio upload
      if (audioBlob) {
        const fileName = `${party.replace(/\s+/g, '_')}_${Date.now()}_audio.webm`;
        const { data, error } = await supabase.storage
          .from('feedback-media')
          .upload(fileName, audioBlob, { contentType: 'audio/webm' });

        if (error) throw error;

        const { data: urlData } = supabase.storage.from('feedback-media').getPublicUrl(fileName);
        audioUrl = urlData.publicUrl;
      }

      // Photo upload
      if (photoFile) {
        const ext = photoFile.name.split('.').pop();
        const fileName = `${party.replace(/\s+/g, '_')}_${Date.now()}_photo.${ext}`;
        const { data, error } = await supabase.storage
          .from('feedback-media')
          .upload(fileName, photoFile, { contentType: photoFile.type });

        if (error) throw error;

        const { data: urlData } = supabase.storage.from('feedback-media').getPublicUrl(fileName);
        photoUrl = urlData.publicUrl;
      }

      // Video upload
      if (videoFile) {
        const ext = videoFile.name?.split('.').pop() || 'webm';
        const fileName = `${party.replace(/\s+/g, '_')}_${Date.now()}_video.${ext}`;
        const { data, error } = await supabase.storage
          .from('feedback-media')
          .upload(fileName, videoFile, { contentType: videoFile.type || 'video/webm' });

        if (error) throw error;

        const { data: urlData } = supabase.storage.from('feedback-media').getPublicUrl(fileName);
        videoUrl = urlData.publicUrl;
      }

      const feedbackData = {
        party,
        transaction_key: transactionKey,
        rating,
        rating_label: ratingLabels[rating - 1],
        remark,
        liked_options: likedOptions.join(', '),
        audio_url: audioUrl,
        photo_url: photoUrl,
        video_url: videoUrl,
        submitted_at: new Date().toISOString()
      };

      const { error } = await supabase.from('feedback2').insert(feedbackData);

      if (error) throw error;

      toast.success('Thank you for your feedback!');
      if (rating >= 4) {
        setShowConfetti(true);
        setTimeout(() => setShowConfetti(false), 5000);
      }

      // Reset form
      setRating(0);
      setRemark('');
      setAudioBlob(null);
      setPhotoFile(null);
      setVideoFile(null);
      setLikedOptions([]);
      setShowAdditional(false);
    } catch (err) {
      console.error('Submit error:', err);
      toast.error('Failed to save feedback');
    }

    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-linear-to-br from-indigo-50 via-white to-purple-50 flex flex-col">
      <Toaster position="top-center" reverseOrder={false} />

      {showConfetti && (
        <Confetti
          width={window.innerWidth}
          height={window.innerHeight}
          numberOfPieces={300}
          recycle={false}
          gravity={0.15}
          colors={['#6366f1', '#8b5cf6', '#ec4899', '#f43f5e', '#10b981', '#f59e0b']}
          className="absolute inset-0 z-50 pointer-events-none"
        />
      )}

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto pb-32"> {/* pb-32 for bottom button space */}
        <div className="max-w-2xl mx-auto p-4 md:p-8">
          {/* Header */}
          <div className="bg-linear-to-r from-indigo-600 via-purple-600 to-pink-600 p-8 text-white text-center rounded-3xl shadow-xl mb-8">
            <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight">
              Feedback for {party}
            </h1>
            <p className="text-indigo-100 mt-3 text-lg">
              Help us serve you better
            </p>
            <p className="text-xs md:text-sm text-indigo-200 mt-2">
              Transaction ID: {transactionKey}
            </p>
          </div>

          {/* Step 1: Rating + Remark */}
          {!showAdditional && (
            <div className="space-y-10 bg-white/95 backdrop-blur-xl p-8 rounded-3xl shadow-xl border border-white/40">
              <div className="text-center">
                <p className="text-xl font-medium text-gray-800 mb-5">
                  How was your experience?
                </p>
                <div className="flex justify-center gap-4">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setRating(star)}
                      onMouseEnter={() => setHoverRating(star)}
                      onMouseLeave={() => setHoverRating(0)}
                      className="focus:outline-none transition-transform hover:scale-110 active:scale-95"
                    >
                      <Star
                        className={`h-14 w-14 drop-shadow-md ${
                          (hoverRating >= star || rating >= star) ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300'
                        } transition-all duration-300`}
                      />
                    </button>
                  ))}
                </div>
                {rating > 0 && (
                  <p className="mt-6 text-2xl md:text-3xl font-bold text-gray-900 flex items-center justify-center gap-3">
                    {ratingLabels[rating - 1]} {ratingEmojis[rating - 1]}
                  </p>
                )}
              </div>

              <div className="space-y-3">
                <label className="block text-lg font-semibold text-gray-800">
                  {getRemarkTitle()}
                </label>
                <p className="text-sm text-gray-500">{getRemarkDescription()}</p>
                <textarea
                  value={remark}
                  onChange={(e) => setRemark(e.target.value)}
                  rows={4}
                  className="w-full px-5 py-4 border border-gray-300 rounded-2xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 resize-none shadow-sm"
                  placeholder={getRemarkPlaceholder()}
                />
              </div>
            </div>
          )}

          {/* Step 2: Likes + Media */}
          {showAdditional && (
            <div className="space-y-10 bg-white/95 backdrop-blur-xl p-8 rounded-3xl shadow-xl border border-white/40">
              <div className="space-y-4">
                <label className="block text-lg font-semibold text-gray-800">
                  {getLikedTitle()}
                </label>
                <div className="grid grid-cols-1 gap-3">
                  {getLikedCheckboxes().map((option, i) => (
                    <div key={i} className="flex items-center gap-3 bg-gray-50 p-4 rounded-xl hover:bg-indigo-50 transition">
                      <input
                        type="checkbox"
                        id={`liked-${i}`}
                        checked={likedOptions.includes(option)}
                        onChange={() => toggleLiked(option)}
                        className="h-5 w-5 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500"
                      />
                      <label htmlFor={`liked-${i}`} className="text-gray-700 cursor-pointer text-base">
                        {option}
                      </label>
                    </div>
                  ))}
                </div>
              </div>

              {/* Media Uploads */}
              <div className="space-y-6">
                <label className="block text-lg font-semibold text-gray-800">
                  Add media (optional)
                </label>

                <div className="grid grid-cols-3 gap-4">
                  {/* Photo */}
                  <label className="flex flex-col items-center gap-2 p-5 bg-indigo-50 rounded-2xl border-2 border-dashed border-indigo-300 hover:border-indigo-500 transition cursor-pointer">
                    <ImageIcon className="h-8 w-8 text-indigo-600" />
                    <span className="text-indigo-700 font-medium text-sm">Photo</span>
                    <input type="file" accept="image/*" onChange={handlePhotoUpload} hidden />
                  </label>

                  {/* Video */}
                  <label className="flex flex-col items-center gap-2 p-5 bg-purple-50 rounded-2xl border-2 border-dashed border-purple-300 hover:border-purple-500 transition cursor-pointer">
                    <Video className="h-8 w-8 text-purple-600" />
                    <span className="text-purple-700 font-medium text-sm">Video</span>
                    <input type="file" accept="video/*" onChange={handleVideoUpload} hidden />
                  </label>

                  {/* Audio */}
                  <button
                    onClick={recording ? stopAudioRecording : startAudioRecording}
                    className={`flex flex-col items-center gap-2 p-5 rounded-2xl border-2 border-dashed transition ${
                      recording 
                        ? 'bg-red-50 border-red-300 text-red-600 hover:bg-red-100' 
                        : 'bg-indigo-50 border-indigo-300 text-indigo-600 hover:bg-indigo-100'
                    }`}
                  >
                    {recording ? (
                      <Loader2 className="h-8 w-8 animate-spin" />
                    ) : (
                      <Mic className="h-8 w-8" />
                    )}
                    <span className="font-medium text-sm">
                      {recording ? 'Stop' : 'Voice'}
                    </span>
                  </button>
                </div>

                {/* Previews */}
                <div className="space-y-4">
                  {audioBlob && (
                    <div className="bg-gray-50 p-3 rounded-xl">
                      <audio controls className="w-full">
                        <source src={URL.createObjectURL(audioBlob)} type="audio/webm" />
                      </audio>
                    </div>
                  )}
                  {photoFile && (
                    <div className="bg-gray-50 p-3 rounded-xl">
                      <p className="text-sm text-green-600">Photo selected: {photoFile.name}</p>
                    </div>
                  )}
                  {videoFile && (
                    <div className="bg-gray-50 p-3 rounded-xl">
                      <p className="text-sm text-green-600">Video selected</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Fixed Bottom Buttons - Always Visible */}
      <div className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md border-t border-gray-200 p-4 shadow-2xl z-50 safe-area-inset-bottom">
        <div className="max-w-2xl mx-auto flex gap-4">
          {!showAdditional ? (
            <>
              <button
                onClick={handleContinue}
                disabled={rating === 0 || loading}
                className="flex-1 py-4 px-6 rounded-2xl font-bold text-white bg-indigo-600 hover:bg-indigo-700 transition disabled:bg-gray-400 disabled:cursor-not-allowed shadow-lg active:scale-95"
              >
                Continue
              </button>
              <button
                onClick={submitFeedback}
                disabled={rating === 0 || loading}
                className="flex-1 py-4 px-6 rounded-2xl font-bold text-white bg-green-600 hover:bg-green-700 transition disabled:bg-gray-400 disabled:cursor-not-allowed shadow-lg active:scale-95"
              >
                Submit
              </button>
            </>
          ) : (
            <button
              onClick={submitFeedback}
              disabled={loading}
              className="w-full py-4 px-6 rounded-2xl font-bold text-white bg-green-600 hover:bg-green-700 transition disabled:bg-gray-400 disabled:cursor-not-allowed shadow-lg active:scale-95"
            >
              {loading ? 'Submitting...' : 'Submit Feedback'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default FeedbackPage;