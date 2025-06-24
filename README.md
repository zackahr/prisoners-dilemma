# Game Theory Research Platform

A comprehensive web-based platform for conducting behavioral economics research through interactive game theory experiments. This platform implements classic economic games to study human decision-making, cooperation patterns, and strategic behavior.

## 🎮 Games Available

### Prisoner's Dilemma
The classic game theory scenario where two players must simultaneously choose to either **Cooperate** or **Defect** without knowing the other player's choice.

**Scoring System:**
- Both Cooperate: 20 points each
- Both Defect: 10 points each  
- One Defects, One Cooperates: 30 points (defector), 0 points (cooperator)

**Features:**
- 25 rounds per match
- Real-time multiplayer or AI bot opponents
- Live cooperation percentage tracking
- Cumulative score calculation

### Ultimatum Game
An economic game where one player proposes how to split a pot of money/coins, and the other player can either accept or reject the offer.

**Rules:**
- If the offer is accepted, both players receive their proposed amounts
- If rejected, both players receive nothing
- Tests fairness perception and economic rationality

## 🏗️ Architecture

### Backend
- **Django 5.1.2** - Web framework
- **PostgreSQL** - Database for game data persistence
- **WebSocket** support for real-time gameplay
- **REST API** for game logic and data export

### Frontend
- **React** - Modern UI framework
- **Tailwind CSS** - Responsive styling
- **Real-time updates** via WebSocket connections
- **Mobile-friendly** design

### Infrastructure
- **Docker** containerization with docker-compose
- **Nginx** reverse proxy with SSL termination
- **Let's Encrypt** SSL certificates
- **Production deployment** ready

## 📊 Data Collection

The platform collects comprehensive behavioral data for research:

- **Player Actions**: Round-by-round decisions and responses
- **Timing Data**: Precise timestamps for decision-making analysis
- **Behavioral Metrics**: Cooperation rates, strategy patterns
- **Geographic Data**: Country/city via IP geolocation (anonymized)
- **Session Data**: Complete game sessions with match outcomes

### Sample Data Structure
```
| player_1_action | player_1_score | player_2_action | player_2_score | cooperation_percent | cumulative_score |
|----------------|----------------|----------------|----------------|-------------------|------------------|
| Cooperate      | 0              | Defect         | 30             | 100%              | 0                |
| Defect         | 10             | Defect         | 10             | 50%               | 10               |
```

## 🚀 Quick Start

### Prerequisites
- Docker and Docker Compose
- Python 3.8+
- Node.js 16+

### Local Development

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd prisoners-dilemma
   ```

2. **Environment Setup**
   ```bash
   # Backend setup
   cd game_project/backend
   cp .env.example .env
   # Edit .env with your configuration
   
   # Install Python dependencies
   pip install -r requirements.txt
   ```

3. **Database Setup**
   ```bash
   # Run migrations
   python manage.py migrate
   
   # Load sample data (optional)
   ./data_prisoners.sh
   ```

4. **Frontend Setup**
   ```bash
   cd ../frontend
   npm install
   npm start
   ```

5. **Run with Docker**
   ```bash
   cd ..
   docker-compose up --build
   ```

### Production Deployment

The platform is configured for production deployment with:
- SSL certificates via Let's Encrypt
- Nginx reverse proxy
- PostgreSQL database
- Automated certificate renewal

```bash
# Production deployment
docker-compose -f docker-compose.yml up -d
```

## 🔧 Configuration

### Environment Variables
```bash
SECRET_KEY=your-django-secret-key
DEBUG=False
DATABASE_URL=postgresql://user:password@db:5432/gametheory
ALLOWED_HOSTS=your-domain.com
```

### Game Parameters
- **Rounds per match**: 25 (configurable)
- **Match timeout**: Configurable
- **Bot difficulty**: Adjustable AI strategies

## 📈 Research Features

### Data Export
- **CSV export** of all game sessions
- **Real-time analytics** dashboard
- **Behavioral pattern analysis**
- **Geographic distribution** of players

### Bot Integration
- Multiple AI strategies for single-player research
- Configurable bot behavior patterns
- Human vs. AI comparative studies

### Anonymization
- Player fingerprinting for privacy
- No personal data collection
- GDPR compliant data handling

## 🛠️ Development

### Project Structure
```
game_project/
├── backend/
│   ├── game/                 # Django project
│   │   ├── the_game/        # Prisoner's Dilemma app
│   │   ├── ultimatum/       # Ultimatum Game app
│   │   └── game/            # Main settings
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── components/      # React components
│   │   ├── prisoners/       # Prisoner's Dilemma UI
│   │   └── ultimatum/       # Ultimatum Game UI
│   └── package.json
└── nginx/                   # Reverse proxy config
```

### API Endpoints
- `GET /api/games/` - List available games
- `POST /api/prisoners/join/` - Join Prisoner's Dilemma match
- `POST /api/ultimatum/join/` - Join Ultimatum Game match
- `GET /api/data/export/` - Export research data

### WebSocket Events
- `player_action` - Real-time game moves
- `match_update` - Game state updates
- `player_joined` - Multiplayer notifications

## 🎯 Research Applications

This platform is designed for:
- **Behavioral Economics** research
- **Game Theory** experiments
- **Social Psychology** studies
- **Cross-cultural** decision-making analysis
- **AI vs. Human** behavior comparison

## 📝 License

This project is designed for academic research purposes. Please cite appropriately when using for research publications.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📞 Support

For research collaboration or technical support, please contact the Social Interaction Lab.

---

**Hosted at**: `gametheory.socialinteractionlab.org`  
**Research Institution**: UM6P Social Interaction Lab