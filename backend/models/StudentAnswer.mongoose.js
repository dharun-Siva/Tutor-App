const mongoose = require('mongoose');

const studentAnswerSchema = new mongoose.Schema({
  assignmentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'HomeworkAssignment',
    required: true
  },
  studentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  exerciseId: {
    type: String,
    default: 'reading_comprehension_001'
  },
  title: {
    type: String,
    default: "Nikolai's Journey - Reading Exercise"
  },
  totalPages: {
    type: Number,
    default: 2
  },
  currentPage: {
    type: Number,
    default: 0
  },
  pages: [{
    pageId: {
      type: Number,
      required: true
    },
    templateType: {
      type: String,
      enum: ['story_with_questions', 'fill_in_blank', 'math_addition'],
      required: true
    },
    components: [{
      type: {
        type: String,
        enum: ['story_block', 'timer_selector', 'multiple_choice_checkbox', 'fill_blank_question'],
        required: true
      },
      content: mongoose.Schema.Types.Mixed,
      questionNumber: Number,
      question: String,
      options: [{
        id: String,
        text: String,
        correct: Boolean
      }],
      template: String,
      blanks: [{
        id: String,
        correctAnswers: [String],
        position: Number,
        studentAnswer: String
      }],
      correctBlanks: [{
        id: String,
        correctAnswers: [String],
        position: Number
      }],
      allowMultiple: Boolean,
      studentAnswer: {
        selected: [mongoose.Schema.Types.Mixed], // Changed from [Number] to support both text and numbers
        isCorrect: Boolean
      },
      correctAnswer: {
        selected: [mongoose.Schema.Types.Mixed], // Changed from [Number] to support both text and numbers
        correctOptions: [{
          id: String,
          text: String
        }]
      }
    }]
  }],
  grading: {
    instantFeedback: {
      type: Boolean,
      default: false
    },
    showCorrectAnswers: {
      type: Boolean,
      default: true
    },
    allowRetries: {
      type: Boolean,
      default: false
    }
  },
  analytics: {
    trackTimePerQuestion: {
      type: Boolean,
      default: true
    },
    trackAttempts: {
      type: Boolean,
      default: true
    },
    trackCompletion: {
      type: Boolean,
      default: true
    }
  },
  // Store correct answers from CSV files
  correctAnswers: {
    type: Map,
    of: {
      questionType: String,
      questionNumber: Number,
      pageId: Number,
      exerciseId: String,
      correctAnswerText: [String], // For multiple correct answers or fill-in-blanks
      correctOptions: [{
        id: String,
        text: String,
        isCorrect: Boolean
      }]
    },
    default: new Map()
  },
  summary: {
    totalQuestions: {
      type: Number,
      default: 0
    },
    correct: {
      type: Number,
      default: 0
    },
    percentage: {
      type: Number,
      default: 0
    },
    status: {
      type: String,
      enum: ['not_started', 'in_progress', 'completed'],
      default: 'not_started'
    }
  },
  // Time tracking for study details
  studyTracking: {
    totalTimeSpent: {
      type: Number, // in minutes
      default: 0
    },
    dailyTime: [{
      date: {
        type: Date,
        required: true
      },
      timeSpent: {
        type: Number, // in minutes
        default: 0
      },
      sessions: [{
        startTime: Date,
        endTime: Date,
        duration: Number // in minutes
      }]
    }],
    startTime: Date, // When student started working
    lastActiveTime: Date, // Last activity timestamp
    isActive: {
      type: Boolean,
      default: false
    }
  },
  taskProgress: [{
    taskId: String,
    taskDescription: String,
    completed: {
      type: Boolean,
      default: false
    },
    completedDate: Date,
    timeSpent: {
      type: Number, // in minutes
      default: 0
    }
  }],
  lastUpdated: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Index for efficient queries
studentAnswerSchema.index({ assignmentId: 1, studentId: 1 });

const StudentAnswer = mongoose.model('StudentAnswer', studentAnswerSchema);

module.exports = StudentAnswer;