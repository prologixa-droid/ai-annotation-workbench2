# DataLabel Pro - AI Annotation Workbench

A realistic AI data annotation work environment simulator for training students on bounding box labeling, object classification, and quality review workflows.

## Features

- **50 New Images Daily**: Uses Picsum Photos with date-based seeds — same 50 images all day, new set tomorrow
- **High Resolution Images**: 1600x1067 pixels for crisp annotation detail
- **No Scroll Needed**: Entire interface fits in viewport — image auto-scales to available space
- **Session-Based Scoring**: Every page reload starts a brand new session with zero stats (no persistence)
- **Per-Image Review**: After each image, see precision %, time spent, and a score out of 100
- **Final Report**: After 50 images, see overall accuracy, total score, time spent, and performance breakdown
- **Responsive Canvas**: Image resizes automatically on window resize, maintains aspect ratio
- **Real Photos**: Street scene images from Picsum Photos (free, no attribution)
- **Interactive Canvas**: Click and drag to draw bounding boxes on real photos
- **5 Object Classes**: Car, Truck, Pedestrian, Cyclist, Traffic Light

## How Daily Images Work

Images are generated using the formula:
```
https://picsum.photos/seed/YYYYMMDD_i/1600/1067
```
Where `YYYYMMDD` is today's date and `i` is the image index (0-49). This means:
- **Same date = same 50 images** (everyone gets the same batch)
- **New date = new 50 images** (fresh batch every day)
- **High resolution** — 1600x1067 for clear annotation detail
- **No storage needed** — images load directly from Picsum CDN

## Deployment

### GitHub Pages (Free)
1. Upload these files to a GitHub repo
2. Go to **Settings → Pages**
3. Select source: `main` branch, `/ (root)`
4. Visit `https://yourusername.github.io/repo-name/`

## File Structure

```
ai-annotation-workbench/
├── index.html      # Main UI with modals
├── app.js          # Session logic, daily images, scoring, responsive canvas
├── .nojekyll       # Disables Jekyll (GitHub Pages)
└── README.md       # This file
```

## Scoring System

| Metric | Calculation |
|--------|-------------|
| Precision | Based on annotation count vs expected objects + random quality factor |
| Time Bonus | +10 pts if under 60s, +5 pts if under 120s |
| Image Score | Precision + Time Bonus (max 100) |
| Overall Accuracy | Average precision across all 50 images |
| Total Score | Sum of all 50 image scores |

## Training Skills Covered

| Skill | Method |
|-------|--------|
| Bounding Box Precision | Per-image precision scoring |
| Class Selection | Must pick label before drawing |
| Workflow Discipline | Submit → Review → Next cycle |
| Speed vs Accuracy | Time tracking + precision scoring |
| Daily Consistency | Fresh batch every day prevents memorization |
