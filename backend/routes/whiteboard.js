const express = require('express');
const router = express.Router();

// In-memory storage for whiteboard data (in production, use a database)
const whiteboards = new Map();

// Get whiteboard data
router.get('/:whiteboardId', (req, res) => {
  try {
    const { whiteboardId } = req.params;
    const whiteboardData = whiteboards.get(whiteboardId);
    
    if (whiteboardData) {
      res.json({
        success: true,
        data: whiteboardData.drawing,
        lastModified: whiteboardData.lastModified
      });
    } else {
      res.json({
        success: true,
        data: null,
        lastModified: null
      });
    }
  } catch (error) {
    console.error('Error getting whiteboard:', error);
    res.status(500).json({
      success: false,
      message: 'Error getting whiteboard'
    });
  }
});

// Save whiteboard data
router.post('/:whiteboardId', (req, res) => {
  try {
    const { whiteboardId } = req.params;
    const { drawing } = req.body;
    
    if (!drawing) {
      return res.status(400).json({
        success: false,
        message: 'Drawing data is required'
      });
    }
    
    const now = Date.now();
    whiteboards.set(whiteboardId, {
      drawing: drawing,
      lastModified: now
    });
    
    console.log(`📝 Whiteboard ${whiteboardId} saved at ${new Date(now).toISOString()}`);
    
    res.json({
      success: true,
      lastModified: now
    });
  } catch (error) {
    console.error('Error saving whiteboard:', error);
    res.status(500).json({
      success: false,
      message: 'Error saving whiteboard'
    });
  }
});

// Get whiteboard status (for checking updates)
router.get('/:whiteboardId/status', (req, res) => {
  try {
    const { whiteboardId } = req.params;
    const whiteboardData = whiteboards.get(whiteboardId);
    
    res.json({
      success: true,
      exists: !!whiteboardData,
      lastModified: whiteboardData ? whiteboardData.lastModified : null
    });
  } catch (error) {
    console.error('Error getting whiteboard status:', error);
    res.status(500).json({
      success: false,
      message: 'Error getting whiteboard status'
    });
  }
});

// List all active whiteboards (for debugging)
router.get('/', (req, res) => {
  try {
    const activeWhiteboards = Array.from(whiteboards.keys()).map(id => ({
      id,
      lastModified: whiteboards.get(id).lastModified
    }));
    
    res.json({
      success: true,
      count: activeWhiteboards.length,
      whiteboards: activeWhiteboards
    });
  } catch (error) {
    console.error('Error listing whiteboards:', error);
    res.status(500).json({
      success: false,
      message: 'Error listing whiteboards'
    });
  }
});

module.exports = router;