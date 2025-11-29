import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Header from '../../shared/components/Header';
import LoadingSpinner from '../../shared/components/LoadingSpinner';
import { getStoredUser } from '../../utils/helpers';
import { homeworkAPI } from '../../utils/api';
import styles from './StudyDetails.module.css';

const StudyDetailsPage = () => {
  const { homeworkId } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [assignment, setAssignment] = useState(null);
  const [selectedMonth, setSelectedMonth] = useState(new Date());
  const [studyData, setStudyData] = useState([]);
  const [error, setError] = useState('');
  const user = getStoredUser();

  // Load assignment details and study data
  useEffect(() => {
    if (homeworkId && user?.id) {
      loadAssignmentAndStudyData();
    }
  }, [homeworkId, user?.id, selectedMonth]);

  const loadAssignmentAndStudyData = async () => {
    try {
      setLoading(true);
      setError('');
      
      // Load study data from API
      const studyResponse = await homeworkAPI.getStudyData(homeworkId, {
        month: selectedMonth.getMonth() + 1,
        year: selectedMonth.getFullYear()
      });
      
      console.log('Study data response:', studyResponse.data);
      
      if (studyResponse.data && studyResponse.data.assignment) {
        setAssignment(studyResponse.data.assignment);
        
        // Process and format study data
        const processedData = processStudyData(studyResponse.data, selectedMonth);
        setStudyData(processedData);
      } else {
        setError('Assignment not found');
      }
    } catch (err) {
      console.error('Error loading study data:', err);
      // Fallback to assignment details if study data fails
      try {
        const assignmentResponse = await homeworkAPI.getAssignmentDetails(homeworkId);
        if (assignmentResponse.data && assignmentResponse.data.assignment) {
          setAssignment(assignmentResponse.data.assignment);
          generateStudyDataForMonth(assignmentResponse.data.assignment, selectedMonth);
        } else {
          setError('Assignment not found');
        }
      } catch (fallbackErr) {
        setError('Failed to load assignment details');
      }
    } finally {
      setLoading(false);
    }
  };

  const processStudyData = (studyDataResponse, month) => {
    const { assignment, studyTracking, taskProgress } = studyDataResponse;
    const year = month.getFullYear();
    const monthIndex = month.getMonth();
    const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
    const today = new Date();
    
    const assignedDate = new Date(assignment.assignedDate);
    const dueDate = new Date(assignment.dueDate);
    
    const data = [];
    
    // Process daily time data from API
    const dailyTimeMap = new Map();
    if (studyTracking && studyTracking.dailyTime) {
      studyTracking.dailyTime.forEach(record => {
        const recordDate = new Date(record.date);
        dailyTimeMap.set(recordDate.toDateString(), record);
      });
    }
    
    // Process task progress
    const taskProgressMap = new Map();
    if (taskProgress) {
      taskProgress.forEach(task => {
        const taskDate = task.completedDate ? new Date(task.completedDate).toDateString() : null;
        if (taskDate) {
          if (!taskProgressMap.has(taskDate)) {
            taskProgressMap.set(taskDate, []);
          }
          taskProgressMap.get(taskDate).push(task);
        }
      });
    }
    
    for (let day = 1; day <= daysInMonth; day++) {
      const currentDate = new Date(year, monthIndex, day);
      const isRelevantDay = currentDate >= assignedDate && currentDate <= dueDate;
      
      if (isRelevantDay) {
        const dateString = currentDate.toDateString();
        const dailyRecord = dailyTimeMap.get(dateString);
        const dayTasks = taskProgressMap.get(dateString) || [];
        
        const dayData = {
          date: currentDate,
          dayNumber: day,
          dayName: currentDate.toLocaleDateString('en-US', { weekday: 'short' }),
          status: getStatusForDay(currentDate, today, assignment, assignedDate, dueDate),
          tasks: dayTasks.length > 0 ? dayTasks.map(task => ({
            id: task.taskId,
            description: task.taskDescription,
            completed: task.completed,
            type: 'custom',
            timeSpent: task.timeSpent || 0
          })) : generateTasksForDay(assignment, currentDate, assignedDate, dueDate),
          timeSpent: dailyRecord ? dailyRecord.timeSpent : 0,
          notes: getNotesForDay(currentDate, assignment)
        };
        data.push(dayData);
      }
    }
    
    return data;
  };

  const generateStudyDataForMonth = (assignment, month) => {
    const year = month.getFullYear();
    const monthIndex = month.getMonth();
    const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
    const today = new Date();
    
    const assignedDate = new Date(assignment.assignedDate);
    const dueDate = new Date(assignment.dueDate);
    
    const data = [];
    
    for (let day = 1; day <= daysInMonth; day++) {
      const currentDate = new Date(year, monthIndex, day);
      const isRelevantDay = currentDate >= assignedDate && currentDate <= dueDate;
      
      if (isRelevantDay) {
        // Generate mock study data based on assignment progress
        const dayData = {
          date: currentDate,
          dayNumber: day,
          dayName: currentDate.toLocaleDateString('en-US', { weekday: 'short' }),
          status: getStatusForDay(currentDate, today, assignment, assignedDate, dueDate),
          tasks: generateTasksForDay(assignment, currentDate, assignedDate, dueDate),
          timeSpent: getTimeSpentForDay(currentDate, today, assignment),
          notes: getNotesForDay(currentDate, assignment)
        };
        data.push(dayData);
      }
    }
    
    setStudyData(data);
  };

  const getStatusForDay = (currentDate, today, assignment, assignedDate, dueDate) => {
    if (currentDate > today) return 'pending';
    if (assignment.status === 'completed' && currentDate <= today) return 'completed';
    if (assignment.status === 'inprogress' && currentDate <= today) return 'progress';
    return 'assigned';
  };

  const generateTasksForDay = (assignment, currentDate, assignedDate, dueDate) => {
    // Create structured tasks based on assignment type
    const totalDays = Math.ceil((dueDate - assignedDate) / (1000 * 60 * 60 * 24));
    const dayIndex = Math.ceil((currentDate - assignedDate) / (1000 * 60 * 60 * 24));
    
    const baseTasks = [
      'Read assigned material',
      'Complete practice problems',
      'Review key concepts',
      'Prepare notes'
    ];
    
    // Distribute tasks across days
    const tasksPerDay = Math.ceil(baseTasks.length / Math.max(totalDays, 1));
    const startIndex = Math.max(0, (dayIndex - 1) * tasksPerDay);
    const endIndex = Math.min(baseTasks.length, dayIndex * tasksPerDay);
    
    return baseTasks.slice(startIndex, endIndex).map((task, index) => ({
      id: `task_${dayIndex}_${index}`,
      description: task,
      completed: assignment.status === 'completed' || 
                 (assignment.status === 'inprogress' && Math.random() > 0.3), // Mock completion
      type: index === 0 ? 'reading' : index === 1 ? 'practice' : 'review'
    }));
  };

  const getTimeSpentForDay = (currentDate, today, assignment) => {
    if (currentDate > today) return 0;
    
    // Mock time spent based on assignment status and day
    if (assignment.status === 'completed') {
      return Math.floor(Math.random() * 60) + 30; // 30-90 minutes
    } else if (assignment.status === 'inprogress') {
      return Math.floor(Math.random() * 45) + 15; // 15-60 minutes
    }
    return 0;
  };

  const getNotesForDay = (currentDate, assignment) => {
    const today = new Date();
    if (currentDate > today) return '';
    
    const sampleNotes = [
      'Completed chapter 3 reading. Key concepts: fractions and decimals.',
      'Worked on practice problems 1-5. Need to review problem 4.',
      'Reviewed multiplication tables. Feeling more confident.',
      'Started essay outline. Good progress on introduction.',
      'Lab experiment went well. Recorded all observations.'
    ];
    
    return Math.random() > 0.6 ? sampleNotes[Math.floor(Math.random() * sampleNotes.length)] : '';
  };

  const handleMonthChange = (direction) => {
    const newMonth = new Date(selectedMonth);
    if (direction === 'prev') {
      newMonth.setMonth(newMonth.getMonth() - 1);
    } else {
      newMonth.setMonth(newMonth.getMonth() + 1);
    }
    setSelectedMonth(newMonth);
  };

  const handleMonthSelect = (event) => {
    const [year, month] = event.target.value.split('-');
    setSelectedMonth(new Date(parseInt(year), parseInt(month) - 1, 1));
  };

  const handleTaskToggle = async (taskId, taskDescription, isCompleted) => {
    try {
      await homeworkAPI.updateTaskProgress(homeworkId, {
        taskId,
        taskDescription,
        completed: isCompleted,
        timeSpent: 0 // Will be tracked automatically
      });
      
      // Refresh data to show updated task status
      loadAssignmentAndStudyData();
    } catch (error) {
      console.error('Failed to update task progress:', error);
    }
  };

  const formatTime = (minutes) => {
    if (minutes === 0) return '0 min';
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    
    if (hours === 0) return `${mins} min`;
    if (mins === 0) return `${hours}h`;
    return `${hours}h ${mins}m`;
  };

  const getProgressPercentage = () => {
    if (studyData.length === 0) return 0;
    const completedDays = studyData.filter(day => day.status === 'completed').length;
    return Math.round((completedDays / studyData.length) * 100);
  };

  if (loading) {
    return (
      <div className={styles.container}>
        <LoadingSpinner />
        <p>Loading study details...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.container}>
        <div className={styles.errorState}>
          <i className="fas fa-exclamation-triangle"></i>
          <h3>Error Loading Study Details</h3>
          <p>{error}</p>
          <button onClick={() => navigate('/student/dashboard')} className={styles.backBtn}>
            <i className="fas fa-arrow-left"></i>
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.studyDetails}>
      <Header 
        title="Study Details" 
        subtitle={assignment?.title || 'Assignment Study Tracking'}
        user={user}
      />
      
      <div className={styles.container}>
        {/* Back Button */}
        <div className={styles.navigation}>
          <button onClick={() => navigate('/student/dashboard')} className={styles.backBtn}>
            <i className="fas fa-arrow-left"></i>
            Back to Dashboard
          </button>
        </div>

        {/* Assignment Overview */}
        <div className={styles.assignmentOverview}>
          <div className={styles.assignmentInfo}>
            <h2>{assignment?.title}</h2>
            <div className={styles.assignmentMeta}>
              <span className={styles.subject}>
                <i className="fas fa-book"></i>
                {assignment?.subject} • {assignment?.grade}
              </span>
              <span className={styles.dueDate}>
                <i className="fas fa-calendar"></i>
                Due: {assignment ? new Date(assignment.dueDate).toLocaleDateString() : 'N/A'}
              </span>
              <span className={`${styles.statusBadge} ${styles[assignment?.status]}`}>
                {assignment?.status === 'assigned' ? 'Pending' :
                 assignment?.status === 'inprogress' ? 'In Progress' :
                 'Completed'}
              </span>
            </div>
          </div>
          <div className={styles.progressCard}>
            <div className={styles.progressCircle}>
              <svg width="80" height="80">
                <circle cx="40" cy="40" r="35" fill="none" stroke="#e9ecef" strokeWidth="6"/>
                <circle 
                  cx="40" 
                  cy="40" 
                  r="35" 
                  fill="none" 
                  stroke="#007bff" 
                  strokeWidth="6"
                  strokeDasharray={`${2 * Math.PI * 35}`}
                  strokeDashoffset={`${2 * Math.PI * 35 * (1 - getProgressPercentage() / 100)}`}
                  transform="rotate(-90 40 40)"
                />
              </svg>
              <div className={styles.progressText}>{getProgressPercentage()}%</div>
            </div>
            <p>Overall Progress</p>
          </div>
        </div>

        {/* Month Selection */}
        <div className={styles.monthControls}>
          <button onClick={() => handleMonthChange('prev')} className={styles.monthBtn}>
            <i className="fas fa-chevron-left"></i>
          </button>
          
          <div className={styles.monthSelector}>
            <select 
              value={`${selectedMonth.getFullYear()}-${String(selectedMonth.getMonth() + 1).padStart(2, '0')}`}
              onChange={handleMonthSelect}
              className={styles.monthSelect}
            >
              {Array.from({ length: 12 }, (_, i) => {
                const year = new Date().getFullYear();
                const month = i;
                const date = new Date(year, month, 1);
                return (
                  <option key={i} value={`${year}-${String(month + 1).padStart(2, '0')}`}>
                    {date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                  </option>
                );
              })}
            </select>
            <h3>{selectedMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</h3>
          </div>
          
          <button onClick={() => handleMonthChange('next')} className={styles.monthBtn}>
            <i className="fas fa-chevron-right"></i>
          </button>
        </div>

        {/* Study Calendar */}
        <div className={styles.studyCalendar}>
          {studyData.length === 0 ? (
            <div className={styles.noData}>
              <i className="fas fa-calendar-times"></i>
              <h3>No study data for this month</h3>
              <p>This assignment doesn't have any scheduled study days in {selectedMonth.toLocaleDateString('en-US', { month: 'long' })}.</p>
            </div>
          ) : (
            <div className={styles.daysList}>
              {studyData.map(day => (
                <div key={day.dayNumber} className={`${styles.dayCard} ${styles[day.status]}`}>
                  <div className={styles.dayHeader}>
                    <div className={styles.dayInfo}>
                      <span className={styles.dayNumber}>{day.dayNumber}</span>
                      <span className={styles.dayName}>{day.dayName}</span>
                    </div>
                    <div className={styles.dayStatus}>
                      <i className={
                        day.status === 'completed' ? 'fas fa-check-circle' :
                        day.status === 'progress' ? 'fas fa-play-circle' :
                        day.status === 'pending' ? 'fas fa-clock' :
                        'fas fa-circle'
                      }></i>
                    </div>
                  </div>
                  
                  <div className={styles.dayContent}>
                    <div className={styles.tasksSection}>
                      <h5>Tasks</h5>
                      <div className={styles.tasksList}>
                        {day.tasks.map(task => (
                          <div key={task.id} className={`${styles.task} ${task.completed ? styles.completed : ''}`}>
                            <button
                              className={styles.taskToggle}
                              onClick={() => handleTaskToggle(task.id, task.description, !task.completed)}
                            >
                              {task.completed ? '✅' : '⏳'}
                            </button>
                            <span className={styles.taskText}>{task.description}</span>
                            {task.timeSpent > 0 && (
                              <span className={styles.taskTime}>
                                {formatTime(task.timeSpent)}
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                    
                    {day.timeSpent > 0 && (
                      <div className={styles.timeSection}>
                        <span className={styles.timeSpent}>
                          <i className="fas fa-clock"></i>
                          {formatTime(day.timeSpent)}
                        </span>
                      </div>
                    )}
                    
                    {day.notes && (
                      <div className={styles.notesSection}>
                        <h6>Notes</h6>
                        <p>{day.notes}</p>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Study Statistics */}
        <div className={styles.studyStats}>
          <h3>Study Statistics</h3>
          <div className={styles.statsGrid}>
            <div className={styles.statCard}>
              <i className="fas fa-calendar-check"></i>
              <div className={styles.statInfo}>
                <span className={styles.statValue}>
                  {studyData.filter(day => day.status === 'completed').length}
                </span>
                <span className={styles.statLabel}>Days Completed</span>
              </div>
            </div>
            
            <div className={styles.statCard}>
              <i className="fas fa-clock"></i>
              <div className={styles.statInfo}>
                <span className={styles.statValue}>
                  {formatTime(studyData.reduce((total, day) => total + day.timeSpent, 0))}
                </span>
                <span className={styles.statLabel}>Total Time</span>
              </div>
            </div>
            
            <div className={styles.statCard}>
              <i className="fas fa-tasks"></i>
              <div className={styles.statInfo}>
                <span className={styles.statValue}>
                  {studyData.reduce((total, day) => total + day.tasks.filter(task => task.completed).length, 0)}
                </span>
                <span className={styles.statLabel}>Tasks Completed</span>
              </div>
            </div>
            
            <div className={styles.statCard}>
              <i className="fas fa-chart-line"></i>
              <div className={styles.statInfo}>
                <span className={styles.statValue}>{getProgressPercentage()}%</span>
                <span className={styles.statLabel}>Progress</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StudyDetailsPage;