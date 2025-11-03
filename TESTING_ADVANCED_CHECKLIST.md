# Manual Testing Guide for Advanced Checklist System

This guide provides step-by-step instructions for manually testing the advanced checklist functionality.

## Prerequisites

1. Ensure the database is set up (SQLite for local, PostgreSQL for production)
2. Have the Gemini API key configured in environment variables
3. Server and client are running

## Test 1: Upload Advanced Checklist from Markdown

**Objective:** Verify that the system can parse and store an advanced checklist from a text file.

### Steps:
1. Start the server: `npm run dev:server`
2. Start the client: `npm run dev`
3. Open browser to `http://localhost:5173` (or appropriate port)
4. Navigate to the checklist section
5. Click "Загрузить файл" (Upload File)
6. Select `sample-advanced-checklist.md` from the root directory
7. Wait for upload to complete

### Expected Results:
- ✅ File uploads successfully
- ✅ System detects it as an "advanced" type checklist
- ✅ Checklist appears in the selector with "Продвинутый" badge
- ✅ When selected, checklist has 5 stages with multiple criteria
- ✅ Each criterion shows MAX/MID/MIN level descriptions and scores
- ✅ Total score should be 100 points

### Verification:
```bash
# Check database (SQLite)
sqlite3 local.db "SELECT * FROM advanced_checklists LIMIT 1;"

# Or via API
curl http://localhost:3000/api/advanced-checklists
```

## Test 2: Analyze Conversation with Advanced Checklist

**Objective:** Verify that the system can analyze a conversation and return MAX/MID/MIN level evaluations.

### Steps:
1. Upload the advanced checklist (from Test 1)
2. Copy content from `sample-transcript.md`
3. Navigate to the analysis page
4. Paste the transcript
5. Select the advanced checklist from the dropdown
6. Click "Analyze" or equivalent button
7. Wait for AI analysis to complete (may take 10-30 seconds)

### Expected Results:
- ✅ Analysis completes without errors
- ✅ Results show overall score (e.g., 75/100)
- ✅ Results show percentage (e.g., 75%)
- ✅ Each stage is displayed as an expandable section (accordion)
- ✅ Each criterion shows:
  - Achieved level (MAX/MID/MIN or null)
  - Score earned
  - Color-coded badge (green=MAX, yellow=MID, red=MIN)
  - Evidence quotes from the conversation
  - AI-generated comment
- ✅ Summary section at the top with overall assessment

### Sample Expected Output:
- **Этап 1: Установление контакта**
  - 1.1 Приветствие: MAX (5 points) ✅
  - 1.2 Установление раппорта: MID (3 points) ⚠️
  - 1.3 Определение времени: MAX (5 points) ✅
  - 1.4 Озвучивание цели звонка: MAX (5 points) ✅

### Verification:
```bash
# Check saved analysis
curl http://localhost:3000/api/advanced-analyses
```

## Test 3: Type Detection and Badge Display

**Objective:** Verify that the system correctly identifies simple vs advanced checklists and displays appropriate badges.

### Steps:
1. Upload a simple checklist (existing functionality)
2. Upload an advanced checklist (Test 1)
3. View the checklist selector dropdown

### Expected Results:
- ✅ Simple checklists show no badge or "simple" indicator
- ✅ Advanced checklists show "Продвинутый" badge in gray/secondary color
- ✅ Both types can coexist in the same list
- ✅ Both types can be selected and used

## Test 4: Excel Upload (if applicable)

**Objective:** Verify Excel file parsing for advanced checklists.

### Steps:
1. Create an Excel file with the following structure:

| Этап | № | Описание этапа | Балл | MAX Критерий | Балл__1 | MID Критерий | Балл__2 | MIN Критерий | Балл__3 |
|------|---|----------------|------|--------------|---------|--------------|---------|--------------|---------|
| Контакт | 1.1 | Приветствие | 5 | Тепло поздоровался | 5 | Формально | 3 | Не поздоровался | 0 |

2. Upload via the UI
3. Verify parsing

### Expected Results:
- ✅ Excel file is correctly parsed
- ✅ Stages are identified from "Этап" column
- ✅ Criterion numbers from "№" column
- ✅ MAX/MID/MIN levels extracted correctly
- ✅ Scores assigned properly

## Test 5: History Tracking

**Objective:** Verify that checklist changes are logged.

### Steps:
1. Upload an advanced checklist
2. Check the database for history entries

### Verification:
```bash
# Check history table
sqlite3 local.db "SELECT * FROM checklist_history;"
```

### Expected Results:
- ✅ Entry created with action="created"
- ✅ Timestamp is recorded
- ✅ Checklist ID matches the created checklist

## Test 6: Error Handling

**Objective:** Verify graceful error handling.

### Test Cases:

#### 6.1 Invalid File Format
- Upload a `.pdf` or `.jpg` file
- **Expected:** Error message about unsupported format

#### 6.2 Malformed Excel
- Upload an Excel with missing required columns
- **Expected:** Error message about parsing failure

#### 6.3 Empty File
- Upload an empty text file
- **Expected:** Error message about empty content

#### 6.4 Invalid JSON Response (simulated)
- This would require AI to return invalid JSON
- **Expected:** Specific error about JSON parsing (added in recent commit)

## Test 7: UI Component Rendering

**Objective:** Verify the AdvancedChecklistResults component renders correctly.

### Steps:
1. Complete an analysis (Test 2)
2. Inspect the UI elements

### Expected Visual Elements:
- ✅ Overall score in large font with color coding
  - Green if ≥80%
  - Yellow if ≥60%
  - Red if <60%
- ✅ "Итоговая сводка" section with gray background
- ✅ Accordion sections for each stage
- ✅ Each criterion card shows:
  - Icon (checkmark, alert, X, or minus)
  - Number and title
  - Badge with level and score
  - Comment text
  - Evidence quotes in blockquote style
  - Timestamps if available

## Test 8: Performance

**Objective:** Verify system handles reasonably large checklists.

### Steps:
1. Create or upload a checklist with 10+ stages and 50+ criteria
2. Analyze a long transcript (2000+ words)
3. Monitor performance

### Expected Results:
- ✅ Upload completes in <5 seconds
- ✅ Analysis completes in <60 seconds
- ✅ UI renders without lag
- ✅ Database queries execute quickly

## Test 9: API Endpoints Direct Testing

**Objective:** Verify API endpoints work correctly.

### Test Commands:

```bash
# Get all advanced checklists
curl http://localhost:3000/api/advanced-checklists

# Get specific checklist
curl http://localhost:3000/api/advanced-checklists/1

# Analyze (requires checklist ID and transcript)
curl -X POST http://localhost:3000/api/advanced-checklists/analyze \
  -H "Content-Type: application/json" \
  -d '{
    "checklistId": "1",
    "transcript": "Здравствуйте...",
    "language": "ru",
    "source": "call"
  }'

# Get analysis history
curl http://localhost:3000/api/advanced-analyses

# Get specific analysis
curl http://localhost:3000/api/advanced-analyses/1
```

## Common Issues and Solutions

### Issue: "Database not found"
**Solution:** Run `npm run db:push` to create tables

### Issue: "Gemini API error"
**Solution:** Check GEMINI_API_KEY environment variable

### Issue: "Type 'advanced' not recognized"
**Solution:** Ensure latest code is deployed, check TypeScript compilation

### Issue: "Badge not showing"
**Solution:** Verify checklist has `type: "advanced"` in response

### Issue: "Analysis returns empty results"
**Solution:** 
- Check Gemini API quota
- Verify transcript is not empty
- Check console for errors

## Success Criteria

All tests should pass with:
- ✅ No errors in browser console
- ✅ No errors in server logs
- ✅ Proper UI rendering
- ✅ Accurate analysis results
- ✅ Database entries created correctly
- ✅ History tracking working

## Cleanup

After testing, you can clean up test data:

```bash
# Clear SQLite database
rm local.db

# Restart server to recreate tables
npm run dev:server
```

## Next Steps

After manual testing passes:
1. Test with real checklists from business users
2. Gather feedback on accuracy of AI evaluations
3. Iterate on UI/UX based on user feedback
4. Add automated tests if needed
5. Deploy to production
