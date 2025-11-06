# 🌯 Burrito Bot - Team Recognition System

Your bot has been transformed into a comprehensive burrito tracking system for Teams group chats!

## 🚀 How to Run Your Burrito Bot

### Option 1: Microsoft 365 Agents Playground (for testing)
```bash
# Run this task in VS Code
"Start Agent in Microsoft 365 Agents Playground"
```

### Option 2: Deploy to Teams
```bash
# Run this task in VS Code
"Start Agent (Sandbox)" 
# or
"Start Agent Locally"
```

## 🌯 Features

### **For Team Members:**
- **Award Burritos:** `give @username a burrito`
- **Award with Reason:** `give @username a burrito for excellent presentation`
- **Check Personal Stats:** `my burritos` or `burrito count`
- **View Leaderboard:** `burrito leaderboard` or `top burritos`
- **Get Help:** `help`

### **For Admins:**
- **Generate Reports:** `/admin report daily|weekly|monthly|yearly`
- **User Stats:** `/admin stats @username`
- **View Leaderboard:** `/admin leaderboard`
- **Help:** `/admin` (shows all admin commands)

## 📊 What Gets Tracked

### **Per User:**
- Total burritos received
- Total burritos given
- Last activity date

### **Per Burrito Award:**
- Recipient and giver
- Timestamp
- Optional reason
- Unique ID for tracking

### **Reports Include:**
- Total burritos awarded in period
- Top burrito recipients (leaderboard)
- Most generous burrito givers
- Time-based filtering (daily/weekly/monthly/yearly)

## 🔧 Setup in Teams Group Chat

1. **Add Bot to Group:** Add your Burrito Bot to a Teams group chat
2. **Auto-Admin Setup:** The person who adds the bot becomes the first admin
3. **Start Awarding:** Team members can immediately start giving burritos
4. **Admin Reports:** Admins can generate reports anytime

## 💡 Example Usage

```
User: give @john a burrito for helping with the project
Bot: 🌯 Burrito awarded! John received a burrito from User for: helping with the project
Bot: 🏆 John now has 5 burritos!

Admin: /admin report weekly
Bot: 📊 Weekly Burrito Report
     📅 Period: 2025-W45
     🌯 Total Burritos Awarded: 12
     
     🏆 Top Burrito Recipients:
     🥇 John: 5 burritos
     🥈 Sarah: 3 burritos
     🥉 Mike: 2 burritos
     
     🤝 Most Generous Burrito Givers:
     🥇 User: 4 burritos given
     🥈 Admin: 3 burritos given
```

## 🏆 Benefits

- **Team Morale:** Recognize great work instantly
- **Data-Driven:** Track recognition patterns over time
- **Admin Insights:** Understand team dynamics
- **Gamification:** Friendly competition with leaderboards
- **Persistent:** All data is saved and tracked over time

## 🔄 Data Persistence

All burrito data is automatically saved including:
- User statistics
- Award history with timestamps
- Admin configurations
- Leaderboard rankings

Data persists between bot restarts and is organized by conversation ID.

---

**Ready to start tracking burritos!** 🌯🎉

Add your bot to a Teams group chat and start recognizing great work!