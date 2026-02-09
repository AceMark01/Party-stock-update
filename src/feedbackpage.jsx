// src/feedbackpage.jsx - Final Complete & Working Version (All Uploads + Confetti + Dynamic UX)

import { useState, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Star, Mic, Send, Loader2, AlertCircle, Image as ImageIcon, Video, Camera } from 'lucide-react';
import toast, { Toaster } from 'react-hot-toast';
import supabase from './supabaseClient';
import Confetti from 'react-confetti';

function FeedbackPage() {
  const [searchParams] = useSearchParams();
  const party = searchParams.get('party') || 'Unknown Party';
  const transactionKey = searchParams.get('key') || 'Unknown Key'; // 'key' from URL

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

  const submitFeedback = async () => {
    if (rating === 0) return toast.error('Please select a rating');

    setLoading(true);

    let audioUrl = null;
    let photoUrl = null;
    let videoUrl = null;

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
    } catch (err) {
      console.error('Submit error:', err);
      toast.error('Failed to save feedback');
    }

    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-linear-to-br from-indigo-50 via-white to-purple-50 flex items-center justify-center p-4 md:p-8 relative overflow-hidden">
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

      <div className="w-full max-w-2xl bg-white/95 backdrop-blur-2xl rounded-3xl shadow-2xl border border-white/40 overflow-hidden">
        {/* Header */}
        <div className="bg-linear-to-r from-indigo-600 via-purple-600 to-pink-600 p-8 text-white text-center relative overflow-hidden">
          <div className="absolute inset-0 bg-black/10"></div>
          <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight relative z-10">
            Feedback for {party}
          </h1>
          <p className="text-indigo-100 mt-3 text-lg relative z-10">
            Help us serve you better
          </p>
          <p className="text-xs md:text-sm text-indigo-200 mt-2 relative z-10">
            Transaction ID: {transactionKey}
          </p>
        </div>

        {/* Form */}
        <div className="p-6 md:p-10 space-y-10">
          {/* Star Rating */}
          <div className="text-center">
            <p className="text-xl font-medium text-gray-800 mb-4">
              My experience was...
            </p>
            <div className="flex justify-center gap-3 md:gap-4">
              {[1, 2, 3, 4, 5].map(star => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setRating(star)}
                  onMouseEnter={() => setHoverRating(star)}
                  onMouseLeave={() => setHoverRating(0)}
                  className="focus:outline-none transition-all duration-300 hover:scale-110 active:scale-95"
                >
                  <Star
                    className={`h-12 w-12 md:h-14 md:w-14 drop-shadow-lg ${
                      (hoverRating >= star || rating >= star) ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300'
                    } transition-all duration-300`}
                  />
                </button>
              ))}
            </div>
            {rating > 0 && (
              <p className="mt-6 text-2xl md:text-3xl font-bold text-gray-900 flex items-center justify-center gap-3 animate-bounce">
                {ratingLabels[rating - 1]} {ratingEmojis[rating - 1]}
              </p>
            )}
          </div>

          {/* Dynamic Tell us more */}
          <div className="space-y-3">
            <label className="block text-lg font-semibold text-gray-800">
              {getRemarkTitle()}
            </label>
            <p className="text-sm text-gray-500">{getRemarkDescription()}</p>
            <textarea
              value={remark}
              onChange={e => setRemark(e.target.value)}
              rows={4}
              className="w-full px-5 py-4 border border-gray-300 rounded-2xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 resize-none shadow-sm"
              placeholder={getRemarkPlaceholder()}
            />
          </div>

          {/* Dynamic What did you like? */}
          <div className="space-y-3">
            <label className="block text-lg font-semibold text-gray-800">
              {getLikedTitle()}
            </label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {getLikedCheckboxes().map((option, i) => (
                <div key={i} className="flex items-center gap-3 bg-gray-50 p-4 rounded-xl hover:bg-indigo-50 transition">
                  <input
                    type="checkbox"
                    id={`liked-${i}`}
                    checked={likedOptions.includes(option)}
                    onChange={() => toggleLiked(option)}
                    className="h-5 w-5 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500"
                  />
                  <label htmlFor={`liked-${i}`} className="text-gray-700 cursor-pointer text-sm md:text-base">
                    {option}
                  </label>
                </div>
              ))}
            </div>
          </div>

          {/* Media Uploads */}
          <div className="grid md:grid-cols-3 gap-6">
            {/* Audio */}
            <div className="space-y-3">
              <label className="block text-base font-medium text-gray-700">
                Voice Note
              </label>
              <button
                onClick={recording ? stopAudioRecording : startAudioRecording}
                className={`w-full py-4 rounded-2xl font-medium transition-all flex items-center justify-center gap-3 shadow-sm ${
                  recording ? 'bg-red-600 text-white hover:bg-red-700' : 'bg-indigo-600 text-white hover:bg-indigo-700'
                }`}
              >
                {recording ? <Loader2 className="h-5 w-5 animate-spin" /> : <Mic className="h-5 w-5" />}
                {recording ? 'Stop Recording' : 'Record Audio'}
              </button>
              {audioBlob && (
                <audio controls className="w-full rounded-xl">
                  <source src={URL.createObjectURL(audioBlob)} type="audio/webm" />
                </audio>
              )}
            </div>

            {/* Photo */}
            <div className="space-y-3">
              <label className="block text-base font-medium text-gray-700">
                Photo
              </label>
              <label className="w-full py-4 bg-indigo-50 rounded-2xl border-2 border-dashed border-indigo-300 hover:border-indigo-500 transition flex flex-col items-center cursor-pointer">
                <ImageIcon className="h-8 w-8 text-indigo-500 mb-2" />
                <span className="text-indigo-600 font-medium">Select Photo</span>
                <input type="file" accept="image/*" onChange={handlePhotoUpload} hidden />
              </label>
              {photoFile && <p className="text-sm text-green-600">Selected: {photoFile.name}</p>}
            </div>

            {/* Video */}
            <div className="space-y-3">
              <label className="block text-base font-medium text-gray-700">
                Video
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="py-4 bg-purple-50 rounded-2xl border-2 border-dashed border-purple-300 hover:border-purple-500 transition flex flex-col items-center cursor-pointer">
                  <Video className="h-6 w-6 text-purple-500 mb-1" />
                  <span className="text-purple-600 text-sm font-medium">Select Video</span>
                  <input type="file" accept="video/*" onChange={handleVideoUpload} hidden />
                </label>

                <button
                  onClick={videoRecording ? stopVideoRecording : startVideoRecording}
                  className={`py-4 rounded-2xl font-medium transition flex flex-col items-center ${
                    videoRecording ? 'bg-red-600 text-white' : 'bg-purple-600 text-white hover:bg-purple-700'
                  }`}
                >
                  {videoRecording ? <Loader2 className="h-6 w-6 animate-spin mb-1" /> : <Camera className="h-6 w-6 mb-1" />}
                  {videoRecording ? 'Stop' : 'Record'}
                </button>
              </div>
              {videoFile && <p className="text-sm text-green-600">Video ready</p>}
            </div>
          </div>

          {/* Submit */}
          <button
            onClick={submitFeedback}
            disabled={loading || rating === 0}
            className={`w-full py-5 rounded-2xl font-bold text-lg transition-all flex items-center justify-center gap-3 shadow-xl ${
              loading || rating === 0 ? 'bg-gray-400 cursor-not-allowed' : 'bg-linear-to-r from-indigo-600 to-purple-700 hover:from-indigo-700 hover:to-purple-800 text-white'
            }`}
          >
            {loading ? (
              <>
                <Loader2 className="h-6 w-6 animate-spin" />
                Submitting...
              </>
            ) : (
              <>
                <Send className="h-6 w-6" />
                Submit Feedback
              </>
            )}
          </button>

          {rating > 0 && rating <= 3 && (
            <div className="text-center text-sm text-amber-700 bg-amber-50 p-4 rounded-2xl border border-amber-200">
              <AlertCircle className="h-5 w-5 inline mr-2" />
              Thank you for your honest feedback. We'll reach out soon!
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default FeedbackPage;