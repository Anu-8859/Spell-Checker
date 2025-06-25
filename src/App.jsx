import React, { useState, useEffect, useCallback } from 'react';
import './App.css';

export default function App() {
  const [dictionary, setDictionary] = useState({});
  const [isDictionaryLoaded, setIsDictionaryLoaded] = useState(false);
  const [text, setText] = useState('Helo worl. This is an exampel of a sentance with some mispeled words.');
  const [checkedWords, setCheckedWords] = useState([]);
  const [activeSuggestions, setActiveSuggestions] = useState({ index: null, suggestions: [] });
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState('Loading dictionary...');

  const damerauLevenshteinDistance = (s1, s2) => {
    const m = s1.length;
    const n = s2.length;
    const dp = Array(m + 1).fill(null).map(() => Array(n + 1).fill(null));

    for (let i = 0; i <= m; i++) dp[i][0] = i;
    for (let j = 0; j <= n; j++) dp[0][j] = j;

    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
        dp[i][j] = Math.min(
          dp[i - 1][j] + 1,
          dp[i][j - 1] + 1,
          dp[i - 1][j - 1] + cost
        );
        if (i > 1 && j > 1 && s1[i - 1] === s2[j - 2] && s1[i - 2] === s2[j - 1]) {
          dp[i][j] = Math.min(dp[i][j], dp[i - 2][j - 2] + 1);
        }
      }
    }
    return dp[m][n];
  };

  useEffect(() => {
    const loadDictionary = async () => {
      try {
        const response = await fetch('/dictionary.json');
        if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
        const data = await response.json();
        setDictionary(data);
        setIsDictionaryLoaded(true);
        setMessage('');
      } catch (error) {
        console.error('Failed to load dictionary:', error);
        setMessage('Error: Could not load dictionary. Please ensure "dictionary.json" is in the "public" folder.');
      }
    };
    loadDictionary();
  }, []);

  const findSuggestions = useCallback((typo) => {
    const maxDistance = 2;
    let foundSuggestions = [];
    const lengthThreshold = 2;

    const candidateWords = Object.keys(dictionary).filter(word =>
      Math.abs(word.length - typo.length) <= lengthThreshold
    );

    for (const dictWord of candidateWords) {
      const distance = damerauLevenshteinDistance(typo, dictWord);
      if (distance <= maxDistance) {
        foundSuggestions.push({ word: dictWord, distance, frequency: dictionary[dictWord] });
      }
    }

    foundSuggestions.sort((a, b) => {
      if (a.distance !== b.distance) return a.distance - b.distance;
      return b.frequency - a.frequency;
    });

    return foundSuggestions.slice(0, 5).map(s => s.word);
  }, [dictionary]);

  const handleSpellCheck = useCallback(() => {
    if (!isDictionaryLoaded) {
      setMessage('Dictionary is still loading. Please wait.');
      return;
    }

    setIsLoading(true);
    setActiveSuggestions({ index: null, suggestions: [] });

    const wordsAndDelimiters = text.split(/([\w']+|\s+|[^\w\s]+)/g);

    const processedWords = wordsAndDelimiters.map(part => {
      if (/[a-zA-Z]/.test(part)) {
        const lowerCasePart = part.toLowerCase();
        const isCorrect = dictionary.hasOwnProperty(lowerCasePart);
        return {
          text: part,
          isWord: true,
          isCorrect: isCorrect,
        };
      }
      return { text: part, isWord: false, isCorrect: true };
    });

    setCheckedWords(processedWords);
    setIsLoading(false);
  }, [text, dictionary, isDictionaryLoaded]);

  const handleWordClick = (word, index) => {
    if (activeSuggestions.index === index) {
      setActiveSuggestions({ index: null, suggestions: [] });
    } else {
      const suggestions = findSuggestions(word.toLowerCase());
      setActiveSuggestions({ index, suggestions });
    }
  };

  const handleSuggestionClick = (suggestion, wordIndex) => {
    const newCheckedWords = [...checkedWords];
    const originalWord = newCheckedWords[wordIndex].text;
    let correctedWord = suggestion;
    if (originalWord.charAt(0) === originalWord.charAt(0).toUpperCase()) {
      correctedWord = suggestion.charAt(0).toUpperCase() + suggestion.slice(1);
    }
    newCheckedWords[wordIndex] = { text: correctedWord, isWord: true, isCorrect: true };
    const newText = newCheckedWords.map(w => w.text).join('');
    setText(newText);
    setCheckedWords(newCheckedWords);
    setActiveSuggestions({ index: null, suggestions: [] });
  };

  const handleVoiceInput = () => {
    const recognition = new (window.SpeechRecognition || window.webkitSpeechRecognition)();
    recognition.lang = 'en-US';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onresult = (event) => {
      const spokenText = event.results[0][0].transcript;
      setText(text + ' ' + spokenText);
    };
    recognition.start();
  };

  return (
    <div className="spell-checker-app">
      <div className="app-container">
        <h1 className="title">Full-Text Spell Checker</h1>
        <p className="subtitle">Check entire blocks of text and correct mistakes with a click.</p>

        <div className="input-area">
          <textarea
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              setCheckedWords([]);
              setActiveSuggestions({ index: null, suggestions: [] });
            }}
            placeholder="Type or paste your text here..."
            className="text-input"
            rows="8"
          />
        </div>

        <div className="button-group">
          <button onClick={handleSpellCheck} disabled={!isDictionaryLoaded || isLoading} className="check-button">
            {isLoading ? 'Checking...' : 'Check Text'}
          </button>

          <button onClick={() => {
            setText('');
            setCheckedWords([]);
            setActiveSuggestions({ index: null, suggestions: [] });
          }} className="clear-button">
            Clear Text
          </button>

          <button onClick={handleVoiceInput} className="voice-button">
            🎙 Speak
          </button>
        </div>

        {message && !isDictionaryLoaded && (
          <div className="status-message">
            <div className="loader"></div>
            {message}
          </div>
        )}

        <div className="results-container">
          {checkedWords.length > 0 && (
            <div className="checked-text-display">
              {checkedWords.map((word, index) =>
                word.isWord && !word.isCorrect ? (
                  <span key={index} className="misspelled-word" onClick={() => handleWordClick(word.text, index)}>
                    {word.text}
                    {activeSuggestions.index === index && (
                      <div className="suggestions-popover">
                        <button
                          className="suggestion-close-btn"
                          onClick={(e) => {
                            e.stopPropagation();
                            setActiveSuggestions({ index: null, suggestions: [] });
                          }}
                        >
                          &times;
                        </button>
                        {activeSuggestions.suggestions.length > 0 ? (
                          activeSuggestions.suggestions.map((s, i) => (
                            <div
                              key={i}
                              className="suggestion-item"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleSuggestionClick(s, index);
                              }}
                            >
                              {s}
                            </div>
                          ))
                        ) : (
                          <div className="no-suggestion-item">No suggestions</div>
                        )}
                      </div>
                    )}
                  </span>
                ) : (
                  <span key={index}>{word.text}</span>
                )
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
