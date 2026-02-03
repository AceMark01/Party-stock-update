// src/Feedback.jsx - Party-wise Feedback Form (Next-Level UI/UX + Fixed Audio Upload)

import { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Star, Mic, Send, Loader2, AlertCircle } from 'lucide-react';
import toast, { Toaster } from 'react-hot-toast';
import supabase from './supabaseClient';

function Feedback() {
  const [searchParams] = useSearchParams();
  const party = searchParams.get('party') || 'Unknown Party';

  const [rating, setRating] = useState(0); // 1=Poor, 2=Average, 3=Good, 4=Best, 5=Excellence
  const [hoverRating, setHoverRating] = useState(0);
  const [remark, setRemark] = useState('');
  const [audioBlob, setAudioBlob] = useState(null);
  const [recording, setRecording] = useState(false);
  const [loading, setLoading] = useState(false);

  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);

  const ratingLabels = ['Poor', 'Average', 'Good', 'Best', 'Excellence'];

  // Start recording
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorderRef.current = new MediaRecorder(stream);
      audioChunksRef.current = [];

      mediaRecorderRef.current.ondataavailable = (e) => {
        audioChunksRef.current.push(e.data);
      };

      mediaRecorderRef.current.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        setAudioBlob(blob);
        console.log('Audio blob created:', blob.size, 'bytes');
      };

      mediaRecorderRef.current.start();
      setRecording(true);
      toast('Recording shuru... Bolte raho!');
    } catch (err) {
      toast.error('Mic permission nahi mili ya available nahi hai');
      console.error('Mic error:', err);
    }
  };

  // Stop recording
  const stopRecording = () => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      setRecording(false);
      toast.success('Recording band ho gayi!');
    }
  };

  // Submit feedback
  const submitFeedback = async () => {
    if (rating === 0) {
      toast.error('Rating to do bhai!');
      return;
    }

    setLoading(true);

    let audioUrl = null;

    if (audioBlob) {
      try {
        const fileName = `${party.replace(/\s+/g, '_')}_${Date.now()}.webm`;
        console.log('Upload shuru:', fileName, 'size:', audioBlob.size);

        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('feedback-audio')
          .upload(fileName, audioBlob, {
            contentType: 'audio/webm',
            cacheControl: '3600',
            upsert: false
          });

        if (uploadError) {
          console.error('Upload error details:', uploadError);
          throw uploadError;
        }

        console.log('Upload success:', uploadData);

        const { data: urlData } = supabase.storage
          .from('feedback-audio')
          .getPublicUrl(fileName);

        audioUrl = urlData.publicUrl;

        if (!audioUrl || audioUrl.includes('null') || audioUrl === '') {
          throw new Error('Public URL nahi mila – bucket public hai?');
        }

        console.log('Audio URL generated:', audioUrl);
        toast.success('Audio upload ho gaya!');
      } catch (err) {
        console.error('Audio upload full error:', err);
        toast.error('Audio upload fail hua (bucket check karo)');
      }
    } else {
      console.log('No audio recorded');
    }

    // Feedback data save
    const feedbackData = {
      party,
      rating,
      rating_label: ratingLabels[rating - 1],
      remark,
      audio_url: audioUrl,
      submitted_at: new Date().toISOString()
    };

    try {
      const { error } = await supabase.from('feedback').insert(feedbackData);

      if (error) throw error;

      toast.success('Feedback submit ho gaya! Shukriya.');

      // Low rating → owner ko WhatsApp alert
      if (rating <= 2) {
        const ownerMessage = `
Low Feedback Alert!

Party: ${party}
Rating: ${ratingLabels[rating - 1]} (${rating} stars)
Remark: ${remark || 'No remark'}
Audio: ${audioUrl || 'No audio'}
Time: ${new Date().toLocaleString()}
        `;

        try {
          await fetch('/functions/v1/send-whatsapp', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              to_number: '919131749390', // Owner ka number
              message: ownerMessage
            })
          });
          toast('Low rating alert owner ko bhej diya!');
        } catch (err) {
          console.error('WhatsApp alert fail:', err);
        }
      }

      // Reset form
      setRating(0);
      setRemark('');
      setAudioBlob(null);
    } catch (err) {
      console.error('Feedback save error:', err);
      toast.error('Feedback save nahi hua – console dekho');
    }

    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-linear-to-br from-indigo-50 via-white to-purple-50 flex items-center justify-center p-4">
      <Toaster position="top-center" reverseOrder={false} />

      <div className="w-full max-w-lg bg-white rounded-3xl shadow-2xl overflow-hidden border border-gray-100">
        {/* Header */}
        <div className="bg-linear-to-r from-indigo-600 to-purple-600 p-6 text-white text-center">
          <h1 className="text-2xl sm:text-3xl font-bold">Feedback for {party}</h1>
          <p className="text-indigo-100 mt-2">Help us improve your experience</p>
        </div>

        {/* Form */}
        <div className="p-6 sm:p-8 space-y-8">
          {/* Star Rating */}
          <div className="text-center">
            <p className="text-lg font-medium text-gray-700 mb-3">How was your experience?</p>
            <div className="flex justify-center gap-2 sm:gap-3">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setRating(star)}
                  onMouseEnter={() => setHoverRating(star)}
                  onMouseLeave={() => setHoverRating(0)}
                  className="focus:outline-none transition-transform hover:scale-110"
                >
                  <Star
                    className={`h-10 w-10 sm:h-12 sm:w-12 ${
                      (hoverRating >= star || rating >= star) ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300'
                    } transition-colors`}
                  />
                </button>
              ))}
            </div>
            {rating > 0 && (
              <p className="mt-3 text-lg font-semibold text-gray-800">
                {ratingLabels[rating - 1]}
              </p>
            )}
          </div>

          {/* Remark */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Your Remarks (optional)
            </label>
            <textarea
              value={remark}
              onChange={(e) => setRemark(e.target.value)}
              rows={4}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 resize-none"
              placeholder="Tell us what you liked or what we can improve..."
            />
          </div>

          {/* Audio Note */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Audio Note (optional)
            </label>
            <div className="flex flex-col sm:flex-row items-center gap-4">
              <button
                type="button"
                onClick={recording ? stopRecording : startRecording}
                className={`flex items-center gap-2 px-5 py-3 rounded-xl font-medium transition-all w-full sm:w-auto ${
                  recording 
                    ? 'bg-red-600 text-white hover:bg-red-700' 
                    : 'bg-indigo-600 text-white hover:bg-indigo-700'
                }`}
              >
                {recording ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" />
                    Stop Recording
                  </>
                ) : (
                  <>
                    <Mic className="h-5 w-5" />
                    Record Audio
                  </>
                )}
              </button>

              {audioBlob && (
                <div className="text-sm text-green-600 flex-1 text-center sm:text-left">
                  Audio recorded ({(audioBlob.size / 1024).toFixed(1)} KB)
                </div>
              )}
            </div>

            {audioBlob && (
              <div className="mt-4">
                <audio controls className="w-full rounded-lg">
                  <source src={URL.createObjectURL(audioBlob)} type="audio/webm" />
                  Your browser does not support audio playback.
                </audio>
              </div>
            )}
          </div>

          {/* Submit */}
          <button
            onClick={submitFeedback}
            disabled={loading || rating === 0}
            className={`w-full py-4 rounded-xl font-semibold text-white transition-all flex items-center justify-center gap-2 ${
              loading || rating === 0
                ? 'bg-gray-400 cursor-not-allowed'
                : 'bg-linear-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 shadow-lg hover:shadow-xl'
            }`}
          >
            {loading ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                Submitting...
              </>
            ) : (
              <>
                <Send className="h-5 w-5" />
                Submit Feedback
              </>
            )}
          </button>

          {/* Low rating note */}
          {rating > 0 && rating <= 2 && (
            <div className="text-center text-sm text-amber-700 bg-amber-50 p-3 rounded-xl">
              <AlertCircle className="h-5 w-5 inline mr-2" />
              Your feedback is important. We'll reach out soon!
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default Feedback;