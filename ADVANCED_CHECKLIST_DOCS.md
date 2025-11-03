# Advanced Checklist System Documentation

## Overview

The advanced checklist system extends the simple checklist functionality with multi-level evaluation support (MAX/MID/MIN). This allows for more nuanced assessment of manager performance with graduated scoring.

## Features

### 1. Multi-Level Evaluation
- **MAX**: Ideal performance - full points awarded
- **MID**: Acceptable performance - partial points awarded  
- **MIN**: Unsatisfactory performance - minimal/no points awarded

### 2. Staged Structure
Checklists can be organized into stages (e.g., "Contact Establishment", "Needs Diagnosis", "Solution Presentation")

### 3. Flexible Criteria
Each criterion can have:
- A weighted score (base points)
- Descriptions for MAX, MID, and MIN levels
- Binary yes/no evaluation for simple criteria

### 4. History Tracking
All checklist changes are tracked in a history table for auditability.

## Data Structure

### Advanced Checklist
```typescript
{
  id: string,
  name: string,
  version: string,
  type: "advanced",
  totalScore: number,
  stages: [
    {
      id: string,
      name: string,
      order: number,
      criteria: [...]
    }
  ]
}
```

### Criterion
```typescript
{
  id: string,
  number: string,        // e.g., "1.1", "2.3"
  title: string,
  description: string,
  weight: number,        // base score
  max?: {
    description: string,
    score: number
  },
  mid?: {
    description: string,
    score: number
  },
  min?: {
    description: string,
    score: number
  },
  isBinary?: boolean     // for yes/no criteria
}
```

### Evaluation Report
```typescript
{
  checklistId: string,
  totalScore: number,
  maxPossibleScore: number,
  percentage: number,
  stages: [
    {
      stageName: string,
      criteria: [
        {
          id: string,
          number: string,
          title: string,
          achievedLevel: "max" | "mid" | "min" | null,
          score: number,
          evidence: [{ text: string, timestamp?: string }],
          comment: string
        }
      ]
    }
  ],
  summary: string
}
```

## API Endpoints

### Checklist Management

#### Upload Advanced Checklist
```
POST /api/checklists/upload
Content-Type: multipart/form-data

File formats: .txt, .md, .csv, .xlsx, .xls
```

The system automatically detects whether a checklist is simple or advanced based on its structure.

#### Get All Advanced Checklists
```
GET /api/advanced-checklists
```

#### Get Single Advanced Checklist
```
GET /api/advanced-checklists/:id
```

### Analysis

#### Analyze with Advanced Checklist
```
POST /api/advanced-checklists/analyze
Content-Type: application/json

{
  "transcript": "conversation text...",
  "checklistId": "123",
  "language": "ru",
  "managerId": "456",
  "source": "call"
}
```

#### Get Advanced Analysis History
```
GET /api/advanced-analyses
```

#### Get Single Advanced Analysis
```
GET /api/advanced-analyses/:id
```

## File Format Specifications

### Excel/CSV Format

Headers required:
- **Этап** or **Stage**: Stage name
- **№**: Criterion number (e.g., "1.1")
- **Описание этапа** or **Description**: Full description
- **Балл**: Base score/weight
- **MAX Критерий** or **MAX**: MAX level description
- **Балл__1**: MAX level score
- **MID Критерий** or **MID**: MID level description
- **Балл__2**: MID level score
- **MIN Критерий** or **MIN**: MIN level description
- **Балл__3**: MIN level score

Example:
| Этап | № | Описание этапа | Балл | MAX Критерий | Балл__1 | MID Критерий | Балл__2 | MIN Критерий | Балл__3 |
|------|---|----------------|------|--------------|---------|--------------|---------|--------------|---------|
| Установление контакта | 1.1 | Приветствие | 5 | Тепло поздоровался, представился | 5 | Поздоровался формально | 3 | Не поздоровался | 0 |

### Text/Markdown Format

For .txt or .md files, use structured text that the AI can parse:

```markdown
# Checklist Name
Total Score: 100

## Stage 1: Contact Establishment (20 points)

### 1.1 Greeting (5 points)
**Description:** Manager greets the client professionally

**MAX (5 points):** Warm greeting, full introduction, asked client's name
**MID (3 points):** Greeted and introduced, but formally
**MIN (0 points):** No greeting or very formal
```

## Frontend Components

### AdvancedChecklistResults
Displays the evaluation results with:
- Overall score and percentage
- Expandable stages (accordion)
- Color-coded level badges (MAX=green, MID=yellow, MIN=red)
- Evidence quotes with timestamps
- Comments for each criterion

Usage:
```tsx
import { AdvancedChecklistResults } from "@/components/advanced-checklist-results";

<AdvancedChecklistResults report={report} />
```

### Checklist Selector
The existing checklist selector now shows a "Продвинутый" badge for advanced checklists.

## Database Schema

### Tables
1. **advanced_checklists**: Main checklist metadata
2. **checklist_stages**: Stages within a checklist
3. **checklist_criteria**: Individual criteria with levels
4. **checklist_history**: Change tracking
5. **advanced_analyses**: Analysis results

### Relationships
```
advanced_checklists (1) -> (many) checklist_stages
checklist_stages (1) -> (many) checklist_criteria
advanced_checklists (1) -> (many) checklist_history
advanced_checklists (1) -> (many) advanced_analyses
```

## AI Integration

The system uses Google Gemini 2.5 Flash to:
1. Parse unstructured text/markdown into advanced checklist format
2. Analyze conversations and determine achieved levels (MAX/MID/MIN)
3. Extract evidence quotes with timestamps
4. Generate evaluation comments and summaries

### Prompting Strategy
The AI is instructed to:
- Use criterion level descriptions to determine achievement
- Extract specific quotes as evidence
- Provide constructive comments
- Generate an overall summary

## Testing

### Sample Files
- `sample-advanced-checklist.md`: Example advanced checklist with 5 stages
- `sample-transcript.md`: Sample conversation for testing evaluation

### Testing Steps
1. Start the server: `npm run dev:server`
2. Open the frontend: `npm run dev`
3. Upload `sample-advanced-checklist.md` via the UI
4. Use the analysis page to analyze `sample-transcript.md`
5. View results with the AdvancedChecklistResults component

## Migration from Simple Checklists

Simple checklists continue to work alongside advanced checklists. The system:
- Detects checklist type automatically during upload
- Returns a `type` field ("simple" or "advanced") in API responses
- Uses separate database tables to avoid conflicts
- Provides separate analysis endpoints

## Security Considerations

1. **Input Validation**: All uploaded files are validated before parsing
2. **SQL Injection**: Drizzle ORM provides parameterized queries
3. **File Size Limits**: 5MB limit for checklist uploads
4. **History Tracking**: All changes are logged for audit purposes

## Performance

- **Database**: Uses indexes on foreign keys for fast joins
- **Caching**: Frontend uses React Query for client-side caching
- **Pagination**: Analysis history limited to last 10 entries by default
- **AI Rate Limits**: Gemini API has rate limits; implement retry logic if needed

## Future Enhancements

Potential improvements (out of scope for MVP):
- [ ] Visual checklist editor with drag-and-drop
- [ ] Access control for checklist editing
- [ ] Export results back to Excel/PDF
- [ ] Version comparison (diff viewer)
- [ ] Weighted stage scoring
- [ ] Custom evaluation formulas
- [ ] Multi-language UI support
