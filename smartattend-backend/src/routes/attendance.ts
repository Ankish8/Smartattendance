import { Router } from 'express';
import { AttendanceController } from '@/controllers/attendance';
import { authenticate, teacherOrAdmin, adminOnly } from '@/middleware/auth';
import { uploadRateLimit, aiProcessingRateLimit } from '@/middleware/security';

const router = Router();
const attendanceController = new AttendanceController();

/**
 * @swagger
 * components:
 *   schemas:
 *     AttendanceRecord:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *         sessionId:
 *           type: string
 *           format: uuid
 *         studentId:
 *           type: string
 *           format: uuid
 *         status:
 *           type: string
 *           enum: [PRESENT, ABSENT, LATE, EXCUSED]
 *         confidence:
 *           type: number
 *           minimum: 0
 *           maximum: 1
 *         matchedName:
 *           type: string
 *         aiMethod:
 *           type: string
 *         notes:
 *           type: string
 *         markedAt:
 *           type: string
 *           format: date-time
 *         verifiedAt:
 *           type: string
 *           format: date-time
 *         verifiedBy:
 *           type: string
 *           format: uuid
 *     
 *     FileUpload:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *         originalName:
 *           type: string
 *         fileName:
 *           type: string
 *         fileSize:
 *           type: integer
 *         processingStatus:
 *           type: string
 *           enum: [PENDING, PROCESSING, COMPLETED, FAILED]
 *         uploadedBy:
 *           type: string
 *           format: uuid
 *         createdAt:
 *           type: string
 *           format: date-time
 */

/**
 * @swagger
 * /api/attendance/upload:
 *   post:
 *     summary: Upload attendance file for AI processing
 *     tags: [Attendance]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - file
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *                 description: CSV file containing attendance data
 *               sessionId:
 *                 type: string
 *                 format: uuid
 *                 description: Optional session ID to associate with upload
 *     responses:
 *       201:
 *         description: File uploaded successfully and is being processed
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   type: object
 *                   properties:
 *                     fileId:
 *                       type: string
 *                       format: uuid
 *                     originalName:
 *                       type: string
 *                     processingStatus:
 *                       type: string
 *       400:
 *         description: Invalid file or missing required fields
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Insufficient permissions
 */
router.post('/upload', authenticate, teacherOrAdmin, uploadRateLimit, aiProcessingRateLimit, attendanceController.uploadFile);

/**
 * @swagger
 * /api/attendance/upload/{fileId}/status:
 *   get:
 *     summary: Get processing status of uploaded file
 *     tags: [Attendance]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: fileId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: File upload ID
 *     responses:
 *       200:
 *         description: Processing status retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   type: object
 *                   properties:
 *                     fileId:
 *                       type: string
 *                       format: uuid
 *                     processingStatus:
 *                       type: string
 *                     processingResult:
 *                       type: object
 *                     processingErrors:
 *                       type: object
 *                     processedAt:
 *                       type: string
 *                       format: date-time
 *                     recordCount:
 *                       type: integer
 *       404:
 *         description: File not found
 *       403:
 *         description: Insufficient permissions
 */
router.get('/upload/:fileId/status', authenticate, attendanceController.getProcessingStatus);

/**
 * @swagger
 * /api/attendance/mark:
 *   post:
 *     summary: Mark individual attendance
 *     tags: [Attendance]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - sessionId
 *               - studentId
 *               - status
 *             properties:
 *               sessionId:
 *                 type: string
 *                 format: uuid
 *               studentId:
 *                 type: string
 *                 format: uuid
 *               status:
 *                 type: string
 *                 enum: [PRESENT, ABSENT, LATE, EXCUSED]
 *               notes:
 *                 type: string
 *     responses:
 *       201:
 *         description: Attendance marked successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   type: object
 *                   properties:
 *                     attendanceRecord:
 *                       $ref: '#/components/schemas/AttendanceRecord'
 *       400:
 *         description: Validation error
 *       404:
 *         description: Session or student not found
 *       403:
 *         description: Insufficient permissions
 */
router.post('/mark', authenticate, teacherOrAdmin, attendanceController.markAttendance);

/**
 * @swagger
 * /api/attendance/bulk-mark:
 *   post:
 *     summary: Mark bulk attendance records
 *     tags: [Attendance]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - sessionId
 *               - records
 *             properties:
 *               sessionId:
 *                 type: string
 *                 format: uuid
 *               records:
 *                 type: array
 *                 items:
 *                   type: object
 *                   required:
 *                     - studentId
 *                     - status
 *                   properties:
 *                     studentId:
 *                       type: string
 *                       format: uuid
 *                     status:
 *                       type: string
 *                       enum: [PRESENT, ABSENT, LATE, EXCUSED]
 *                     notes:
 *                       type: string
 *     responses:
 *       201:
 *         description: Bulk attendance marked successfully
 *       400:
 *         description: Validation error
 *       404:
 *         description: Session or students not found
 *       403:
 *         description: Insufficient permissions
 */
router.post('/bulk-mark', authenticate, teacherOrAdmin, attendanceController.markBulkAttendance);

/**
 * @swagger
 * /api/attendance:
 *   get:
 *     summary: Get attendance records with filtering and pagination
 *     tags: [Attendance]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *         description: Page number for pagination
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 10
 *         description: Number of records per page
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           default: markedAt
 *         description: Field to sort by
 *       - in: query
 *         name: sortOrder
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *           default: desc
 *         description: Sort order
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [PRESENT, ABSENT, LATE, EXCUSED]
 *         description: Filter by attendance status
 *       - in: query
 *         name: sessionId
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Filter by session ID
 *       - in: query
 *         name: studentId
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Filter by student ID
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *         description: Filter records from this date
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *         description: Filter records until this date
 *     responses:
 *       200:
 *         description: Attendance records retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   type: object
 *                   properties:
 *                     records:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/AttendanceRecord'
 *                 meta:
 *                   type: object
 *                   properties:
 *                     total:
 *                       type: integer
 *                     page:
 *                       type: integer
 *                     limit:
 *                       type: integer
 *                     totalPages:
 *                       type: integer
 *       401:
 *         description: Authentication required
 */
router.get('/', authenticate, attendanceController.getAttendanceRecords);

/**
 * @swagger
 * /api/attendance/analytics:
 *   get:
 *     summary: Get attendance analytics and statistics
 *     tags: [Attendance]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: sessionId
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Filter analytics for specific session
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *         description: Analytics from this date
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *         description: Analytics until this date
 *     responses:
 *       200:
 *         description: Attendance analytics retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   type: object
 *                   properties:
 *                     analytics:
 *                       type: object
 *                       properties:
 *                         totalRecords:
 *                           type: integer
 *                         attendanceByStatus:
 *                           type: object
 *                           additionalProperties:
 *                             type: integer
 *                         attendanceBySubject:
 *                           type: object
 *                           additionalProperties:
 *                             type: integer
 *                         recentTrends:
 *                           type: array
 *                           items:
 *                             type: object
 *                             properties:
 *                               date:
 *                                 type: string
 *                                 format: date
 *                               attendance:
 *                                 type: number
 *       401:
 *         description: Authentication required
 */
router.get('/analytics', authenticate, attendanceController.getAttendanceAnalytics);

/**
 * @swagger
 * /api/attendance/feedback:
 *   post:
 *     summary: Provide feedback for AI matching accuracy
 *     tags: [Attendance]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - originalName
 *               - correctStudentId
 *               - wasCorrect
 *               - confidence
 *             properties:
 *               originalName:
 *                 type: string
 *                 description: Original name from uploaded file
 *               correctStudentId:
 *                 type: string
 *                 format: uuid
 *                 description: Correct student ID for the name
 *               wasCorrect:
 *                 type: boolean
 *                 description: Whether the AI matching was correct
 *               confidence:
 *                 type: number
 *                 minimum: 0
 *                 maximum: 1
 *                 description: Confidence score of the original match
 *               context:
 *                 type: object
 *                 description: Additional context for learning
 *     responses:
 *       200:
 *         description: Feedback recorded successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *       400:
 *         description: Validation error
 *       401:
 *         description: Authentication required
 */
router.post('/feedback', authenticate, teacherOrAdmin, attendanceController.provideFeedback);

export default router;