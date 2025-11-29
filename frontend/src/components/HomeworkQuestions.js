import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Paper,
  Button,
  FormControl,
  FormControlLabel,
  Radio,
  RadioGroup,
  TextField,
  Checkbox,
  CircularProgress,
  Alert,
  Breadcrumbs,
  Link
} from '@mui/material';
import NavigateNextIcon from '@mui/icons-material/NavigateNext';
import NavigateBeforeIcon from '@mui/icons-material/NavigateBefore';

const HomeworkQuestions = () => {
  const { homeworkId } = useParams();
  const navigate = useNavigate();
  const [currentPage, setCurrentPage] = useState(0);
  const [exerciseData, setExerciseData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [answers, setAnswers] = useState({});

  useEffect(() => {
    const loadHomeworkData = async () => {
      try {
        // Get homework data from parent component or fetch directly
        const response = await fetch(`/api/homework-assignments/${homeworkId}`);
        const data = await response.json();
        
        if (data.success && data.assignment && data.assignment.exerciseData) {
          console.log('Raw exercise data:', data.assignment.exerciseData);
          const parsedData = JSON.parse(data.assignment.exerciseData)[0]; // Get first exercise
          console.log('Parsed exercise data:', parsedData);
          setExerciseData(parsedData);
        } else {
          console.error('No exercise data found:', data);
          setError('No exercise data found for this homework');
        }
      } catch (err) {
        console.error('Error loading homework:', err);
        setError('Failed to load homework questions');
      } finally {
        setLoading(false);
      }
    };

    loadHomeworkData();
  }, [homeworkId]);

  const handleAnswerChange = (questionId, value) => {
    setAnswers(prev => ({
      ...prev,
      [questionId]: value
    }));
  };

  const renderStoryBlock = (content) => {
    return (
      <Box mb={3}>
        {content.text_segments.map((segment, index) => (
          <Box key={index} display="flex" alignItems="center">
            {segment.text && (
              <Typography 
                component="span"
                sx={{
                  fontWeight: segment.style === 'bold' ? 'bold' : 'normal',
                  fontStyle: segment.style === 'italic' ? 'italic' : 'normal'
                }}
              >
                {segment.text}
              </Typography>
            )}
            {segment.image && (
              <Box 
                component="span" 
                sx={{ 
                  fontSize: segment.image.size === 'small' ? '1.5em' : '2em',
                  marginLeft: 1
                }}
              >
                {segment.image.src}
              </Box>
            )}
          </Box>
        ))}
      </Box>
    );
  };

  const renderQuestion = (component) => {
    switch (component.type) {
      case 'story_block':
        return renderStoryBlock(component.content);
      case 'multiple_choice_checkbox':
        return (
          <FormControl component="fieldset" fullWidth margin="normal">
            <Typography variant="h6">
              {component.question_number}. {component.question}
            </Typography>
            {component.options.map((option) => (
              <FormControlLabel
                key={option.id}
                control={
                  <Checkbox
                    checked={answers[component.question_number]?.includes(option.id)}
                    onChange={(e) => {
                      const currentAnswers = answers[component.question_number] || [];
                      if (e.target.checked) {
                        handleAnswerChange(component.question_number, [...currentAnswers, option.id]);
                      } else {
                        handleAnswerChange(
                          component.question_number,
                          currentAnswers.filter(id => id !== option.id)
                        );
                      }
                    }}
                  />
                }
                label={option.text}
              />
            ))}
          </FormControl>
        );

      case 'fill_blank_question':
        return (
          <Box mb={3}>
            <Typography variant="h6">
              {component.question_number}. {component.question}
            </Typography>
            <TextField
              fullWidth
              variant="outlined"
              margin="normal"
              value={answers[component.question_number] || ''}
              onChange={(e) => handleAnswerChange(component.question_number, e.target.value)}
            />
          </Box>
        );

      default:
        return null;
    }
  };

  if (loading) {
    return <CircularProgress />;
  }

  if (error) {
    return <Alert severity="error">{error}</Alert>;
  }

  if (!exerciseData || !exerciseData.pages) {
    return <Alert severity="warning">No questions available</Alert>;
  }

  const currentPageData = exerciseData.pages[currentPage];

  return (
    <Box sx={{ maxWidth: 800, mx: 'auto', p: 3 }}>
      <Breadcrumbs separator="›" aria-label="breadcrumb" sx={{ mb: 3 }}>
        <Link color="inherit" onClick={() => navigate('/dashboard')} sx={{ cursor: 'pointer' }}>
          Dashboard
        </Link>
        <Typography color="text.primary">
          {exerciseData.title || 'Homework Questions'}
        </Typography>
      </Breadcrumbs>

      <Paper elevation={3} sx={{ p: 3 }}>
        <Typography variant="h5" gutterBottom>
          {exerciseData.title || 'Homework Questions'}
        </Typography>
        
        {currentPageData?.components?.map((component, index) => (
          <Box key={index} my={2}>
            {renderQuestion(component)}
          </Box>
        ))}

        <Box sx={{ mt: 3, display: 'flex', justifyContent: 'space-between' }}>
          <Button
            variant="contained"
            startIcon={<NavigateBeforeIcon />}
            disabled={currentPage === 0}
            onClick={() => setCurrentPage(prev => prev - 1)}
          >
            Previous
          </Button>
          <Typography>
            Page {currentPage + 1} of {exerciseData.pages.length}
          </Typography>
          <Button
            variant="contained"
            endIcon={<NavigateNextIcon />}
            disabled={currentPage === exerciseData.pages.length - 1}
            onClick={() => setCurrentPage(prev => prev + 1)}
          >
            Next
          </Button>
        </Box>
      </Paper>
    </Box>
  );
};

export default HomeworkQuestions;
