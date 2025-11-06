import { App } from "@microsoft/teams.apps";
import { LocalStorage } from "@microsoft/teams.common";
import { MessageActivity, TokenCredentials } from '@microsoft/teams.api';
import { ManagedIdentityCredential } from '@azure/identity';
import config from "../config";

// Interfaces for burrito tracking
interface BurritoAward {
  id: string;
  recipientId: string;
  recipientName: string;
  giverId: string;
  giverName: string;
  conversationId: string;
  timestamp: Date;
  reason?: string;
}

interface UserBurritoStats {
  userId: string;
  userName: string;
  totalReceived: number;
  totalGiven: number;
  lastUpdated: Date;
}

interface ConversationData {
  conversationId: string;
  admins: string[]; // User IDs of admins
  burritoAwards: BurritoAward[];
  userStats: Map<string, UserBurritoStats>;
}

// Helper functions for date calculations
const getDateKey = (date: Date, period: 'daily' | 'weekly' | 'monthly' | 'yearly'): string => {
  const year = date.getFullYear();
  const month = date.getMonth();
  const day = date.getDate();
  
  switch (period) {
    case 'daily':
      return `${year}-${month + 1}-${day}`;
    case 'weekly':
      const startOfWeek = new Date(date);
      startOfWeek.setDate(date.getDate() - date.getDay());
      return `${startOfWeek.getFullYear()}-W${Math.ceil(startOfWeek.getDate() / 7)}`;
    case 'monthly':
      return `${year}-${month + 1}`;
    case 'yearly':
      return `${year}`;
    default:
      return `${year}-${month + 1}-${day}`;
  }
};

// Create storage for conversation history and burrito tracking
const conversationDataStore = new Map<string, ConversationData>();

// Helper functions for burrito tracking
const getConversationData = async (conversationId: string): Promise<ConversationData> => {
  const key = `burrito-data-${conversationId}`;
  let data = conversationDataStore.get(key);
  
  if (!data) {
    data = {
      conversationId: conversationId,
      admins: [],
      burritoAwards: [],
      userStats: new Map<string, UserBurritoStats>()
    };
    conversationDataStore.set(key, data);
  }
  
  return data;
};

const saveConversationData = async (data: ConversationData): Promise<void> => {
  const key = `burrito-data-${data.conversationId}`;
  conversationDataStore.set(key, data);
};

const isAdmin = (userId: string, conversationData: ConversationData): boolean => {
  return conversationData.admins.includes(userId);
};

const awardBurrito = (
  conversationData: ConversationData,
  recipientId: string,
  recipientName: string,
  giverId: string,
  giverName: string,
  reason?: string
): BurritoAward => {
  const award: BurritoAward = {
    id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    recipientId,
    recipientName,
    giverId,
    giverName,
    conversationId: conversationData.conversationId,
    timestamp: new Date(),
    reason
  };
  
  // Add to awards list
  conversationData.burritoAwards.push(award);
  
  // Update recipient stats
  let recipientStats = conversationData.userStats.get(recipientId);
  if (!recipientStats) {
    recipientStats = {
      userId: recipientId,
      userName: recipientName,
      totalReceived: 0,
      totalGiven: 0,
      lastUpdated: new Date()
    };
  }
  recipientStats.totalReceived++;
  recipientStats.userName = recipientName; // Update name in case it changed
  recipientStats.lastUpdated = new Date();
  conversationData.userStats.set(recipientId, recipientStats);
  
  // Update giver stats
  let giverStats = conversationData.userStats.get(giverId);
  if (!giverStats) {
    giverStats = {
      userId: giverId,
      userName: giverName,
      totalReceived: 0,
      totalGiven: 0,
      lastUpdated: new Date()
    };
  }
  giverStats.totalGiven++;
  giverStats.userName = giverName; // Update name in case it changed
  giverStats.lastUpdated = new Date();
  conversationData.userStats.set(giverId, giverStats);
  
  return award;
};

const showLeaderboard = async (conversationData: ConversationData, send: Function): Promise<void> => {
  const userStatsArray = Array.from(conversationData.userStats.values())
    .sort((a, b) => b.totalReceived - a.totalReceived)
    .slice(0, 10);
  
  if (userStatsArray.length === 0) {
    await send('🌯 No burritos have been awarded yet! Be the first to give someone a burrito!');
    return;
  }
  
  let leaderboard = '🏆 **Burrito Leaderboard** 🏆\n\n';
  userStatsArray.forEach((stats, index) => {
    const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}.`;
    leaderboard += `${medal} ${stats.userName}: ${stats.totalReceived} burrito${stats.totalReceived !== 1 ? 's' : ''}\n`;
  });
  
  await send(leaderboard);
};

const generateReport = (conversationData: ConversationData, period: 'daily' | 'weekly' | 'monthly' | 'yearly', date?: Date): string => {
  const targetDate = date || new Date();
  const periodKey = getDateKey(targetDate, period);
  
  // Filter awards for the specified period
  const periodAwards = conversationData.burritoAwards.filter(award => {
    const awardDate = new Date(award.timestamp);
    return getDateKey(awardDate, period) === periodKey;
  });
  
  if (periodAwards.length === 0) {
    return `📊 No burritos were awarded during this ${period} period.`;
  }
  
  // Calculate stats
  const recipientStats = new Map<string, number>();
  const giverStats = new Map<string, number>();
  
  periodAwards.forEach(award => {
    recipientStats.set(award.recipientName, (recipientStats.get(award.recipientName) || 0) + 1);
    giverStats.set(award.giverName, (giverStats.get(award.giverName) || 0) + 1);
  });
  
  // Build report
  let report = `📊 **${period.charAt(0).toUpperCase() + period.slice(1)} Burrito Report**\n`;
  report += `📅 Period: ${periodKey}\n`;
  report += `🌯 Total Burritos Awarded: ${periodAwards.length}\n\n`;
  
  // Top recipients
  const topRecipients = Array.from(recipientStats.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);
  
  if (topRecipients.length > 0) {
    report += '🏆 **Top Burrito Recipients:**\n';
    topRecipients.forEach(([name, count], index) => {
      const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}.`;
      report += `${medal} ${name}: ${count} burrito${count !== 1 ? 's' : ''}\n`;
    });
    report += '\n';
  }
  
  // Top givers
  const topGivers = Array.from(giverStats.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);
  
  if (topGivers.length > 0) {
    report += '🤝 **Most Generous Burrito Givers:**\n';
    topGivers.forEach(([name, count], index) => {
      const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}.`;
      report += `${medal} ${name}: ${count} burrito${count !== 1 ? 's' : ''} given\n`;
    });
  }
  
  return report;
};

const handleAdminCommand = async (command: string, conversationData: ConversationData, send: Function): Promise<void> => {
  const parts = command.split(' ');
  const subCommand = parts[1]?.toLowerCase();
  
  switch (subCommand) {
    case 'add':
      // Extract username from mention
      const addMatch = command.match(/<at>([^<]+)<\/at>/);
      if (!addMatch) {
        await send('❌ Please mention a user to add as admin: `/admin add @username`');
        return;
      }
      // This would need the actual user ID, but for now we'll use a placeholder
      await send('⚠️ Admin management requires integration with Teams user directory. This feature needs additional setup.');
      break;
      
    case 'report':
      const period = parts[2]?.toLowerCase() as 'daily' | 'weekly' | 'monthly' | 'yearly';
      if (!['daily', 'weekly', 'monthly', 'yearly'].includes(period)) {
        await send('❌ Please specify a valid period: daily, weekly, monthly, or yearly\nExample: `/admin report weekly`');
        return;
      }
      const report = generateReport(conversationData, period);
      await send(report);
      break;
      
    case 'stats':
      const statsMatch = command.match(/<at>([^<]+)<\/at>/);
      if (!statsMatch) {
        await send('❌ Please mention a user to get stats: `/admin stats @username`');
        return;
      }
      const userName = statsMatch[1];
      const userStats = Array.from(conversationData.userStats.values()).find(s => s.userName === userName);
      if (userStats) {
        await send(`📊 **Stats for ${userName}:**\n🌯 Burritos Received: ${userStats.totalReceived}\n🤝 Burritos Given: ${userStats.totalGiven}\n📅 Last Updated: ${new Date(userStats.lastUpdated).toLocaleDateString()}`);
      } else {
        await send(`❌ No burrito stats found for ${userName}`);
      }
      break;
      
    case 'leaderboard':
      await showLeaderboard(conversationData, send);
      break;
      
    default:
      await send('❌ **Admin Commands:**\n• `/admin report daily/weekly/monthly/yearly` - Generate reports\n• `/admin stats @username` - Get user stats\n• `/admin add @username` - Add admin (needs setup)\n• `/admin leaderboard` - Show leaderboard');
  }
  
  saveConversationData(conversationData);
};

const createTokenFactory = () => {
  return async (scope: string | string[], tenantId?: string): Promise<string> => {
    const managedIdentityCredential = new ManagedIdentityCredential({
        clientId: process.env.CLIENT_ID
      });
    const scopes = Array.isArray(scope) ? scope : [scope];
    const tokenResponse = await managedIdentityCredential.getToken(scopes, {
      tenantId: tenantId
    });
   
    return tokenResponse.token;
  };
};

// Configure authentication using TokenCredentials
const tokenCredentials: TokenCredentials = {
  clientId: process.env.CLIENT_ID || '',
  token: createTokenFactory()
};

const credentialOptions = config.MicrosoftAppType === "UserAssignedMsi" ? { ...tokenCredentials } : undefined;

// Create the app (no storage needed for in-memory approach)
const app = new App({
  ...credentialOptions
});

// Handle incoming messages
app.on('message', async ({ send, activity }) => {
  try {
    const userMessage = activity.text?.toLowerCase() || '';
    const conversationId = activity.conversation.id;
    const userId = activity.from.id;
    const userName = activity.from.name || 'Unknown User';
    // Better group chat detection - check for multiple ways Teams indicates group chats
    const isGroupChat = activity.conversation.isGroup || 
                       activity.conversation.conversationType === 'groupChat' ||
                       activity.conversation.conversationType === 'channel';
    
    // Get conversation data
    const conversationData = await getConversationData(conversationId);
    

    
    // Debug logging
    console.log(`Message from ${userName} (${userId}) in ${isGroupChat ? 'group' : 'personal'} chat: "${activity.text}"`);
    console.log(`Conversation type: ${activity.conversation.conversationType}, isGroup: ${activity.conversation.isGroup}`);
    
    // Special command to make yourself admin (for setup)
    if (userMessage === '/makeadmin' || userMessage === '/makemeadmin') {
      if (!conversationData.admins.includes(userId)) {
        conversationData.admins.push(userId);
        saveConversationData(conversationData);
        await send(`👑 Success! You (${userName}) are now an admin!\n🆔 Your User ID: ${userId}\n🔧 You can now use all admin commands.`);
      } else {
        await send(`👑 You (${userName}) are already an admin!\n🆔 Your User ID: ${userId}`);
      }
      return;
    }
    
    // Debug command to show user info
    if (userMessage === '/debug' || userMessage === '/info') {
      const debugInfo = `🔍 **Debug Info:**\n👤 **User:** ${userName}\n🆔 **User ID:** ${userId}\n💬 **Chat Type:** ${isGroupChat ? 'Group Chat' : 'Personal Chat'}\n🗨️ **Conversation ID:** ${conversationId}\n👑 **Admin:** ${isAdmin(userId, conversationData) ? 'Yes' : 'No'}\n📊 **Admins Count:** ${conversationData.admins.length}`;
      await send(debugInfo);
      return;
    }

    // Admin commands (work in both group and personal chat)
    if (userMessage.startsWith('/admin')) {
      if (!isAdmin(userId, conversationData)) {
        await send(`❌ You are not an admin of this burrito tracking system.\n\n💡 **Tip:** Use "/makeadmin" to become an admin, or ask an existing admin to add you.`);
        return;
      }
      await handleAdminCommand(userMessage, conversationData, send);
      return;
    }
    
    // Check for burrito awards - support both group chat mentions and personal chat simple names
    
    // Method 1: Group chat with @mentions (traditional way)
    if (isGroupChat) {
      const burritoAwardRegex = /(give|award|grant)\s+<at>([^<]+)<\/at>\s+(a\s+)?burrito/i;
      const burritoAwardMatch = userMessage.match(burritoAwardRegex);
      
      if (burritoAwardMatch) {
        const recipientName = burritoAwardMatch[2];
        // Extract reason if provided
        const reasonMatch = userMessage.match(/for\s+(.+)$/i);
        const reason = reasonMatch ? reasonMatch[1] : undefined;
        
        // Find recipient ID from mentions
        const mentions = activity.entities?.filter(e => e.type === 'mention') || [];
        const recipientMention = mentions.find(m => m.text === `<at>${recipientName}</at>`);
        
        if (recipientMention) {
          const recipientId = recipientMention.mentioned.id;
          
          // Prevent self-awarding
          if (recipientId === userId) {
            await send('🚫 Nice try, but you can\'t give yourself a burrito!');
            return;
          }
          
          // Award the burrito
          const award = awardBurrito(conversationData, recipientId, recipientName, userId, userName, reason);
          saveConversationData(conversationData);
          
          const reasonText = reason ? ` for: ${reason}` : '';
          await send(`🌯 Burrito awarded! ${recipientName} received a burrito from ${userName}${reasonText}`);
          
          // Show recipient's total
          const recipientStats = conversationData.userStats.get(recipientId);
          if (recipientStats) {
            await send(`🏆 ${recipientName} now has ${recipientStats.totalReceived} burrito${recipientStats.totalReceived !== 1 ? 's' : ''}!`);
          }
          return;
        }
      }
    }
    
    // Method 2: Simple burrito awarding (works in both personal and group chat)
    // Format: "give John a burrito" or "award burrito to Sarah for great work"
    const simpleBurritoRegex = /(give|award|grant)\s+([a-zA-Z0-9\s_-]+?)\s+(a\s+)?burrito/i;
    const simpleBurritoMatch = userMessage.match(simpleBurritoRegex);
    
    if (simpleBurritoMatch) {
      const recipientName = simpleBurritoMatch[2].trim();
      
      // Don't process if it looks like it was trying to use @mentions
      if (recipientName.includes('<at>') || recipientName.includes('@')) {
        // Skip this, let it fall through to other handlers
      } else {
        // Extract reason if provided
        const reasonMatch = userMessage.match(/for\s+(.+)$/i);
        const reason = reasonMatch ? reasonMatch[1] : undefined;
        
        // Count burrito emojis in the original message to determine how many burritos to award
        const originalText = activity.text || '';
        const burritoEmojiCount = (originalText.match(/🌯/g) || []).length;
        const burritosToAward = Math.max(1, burritoEmojiCount); // At least 1 burrito, more if emojis present
        
        // Generate a fake recipient ID for demo purposes (in real app, you'd need user lookup)
        const recipientId = `demo-user-${recipientName.toLowerCase().replace(/\s+/g, '-')}`;
        
        // Prevent self-awarding by name
        if (recipientName.toLowerCase() === userName.toLowerCase()) {
          await send('🚫 Nice try, but you can\'t give yourself a burrito!');
          return;
        }
        
        // Award multiple burritos if emojis were used
        for (let i = 0; i < burritosToAward; i++) {
          const award = awardBurrito(conversationData, recipientId, recipientName, userId, userName, reason);
        }
        saveConversationData(conversationData);
        
        const reasonText = reason ? ` for: ${reason}` : '';
        const chatType = isGroupChat ? 'group chat' : 'personal chat';
        const emojiBonus = burritoEmojiCount > 0 ? ` (${burritoEmojiCount} 🌯 emoji${burritoEmojiCount !== 1 ? 's' : ''} = ${burritosToAward} burrito${burritosToAward !== 1 ? 's' : ''}!)` : '';

        await send(`🌯 Burrito${burritosToAward !== 1 ? 's' : ''} awarded in ${chatType}! ${recipientName} received ${burritosToAward} burrito${burritosToAward !== 1 ? 's' : ''} from ${userName}${reasonText}${emojiBonus}`);        // Show recipient's total
        const recipientStats = conversationData.userStats.get(recipientId);
        if (recipientStats) {
          await send(`🏆 ${recipientName} now has ${recipientStats.totalReceived} burrito${recipientStats.totalReceived !== 1 ? 's' : ''}!`);
        }
        
        return;
      }
    }
    
    // Method 3: Emoji-only burrito awarding
    // Format: "🌯🌯🌯 for John" or "Great work Sarah! 🌯🌯"
    const emojiBurritoRegex = /🌯/g;
    const emojiMatches = (activity.text || '').match(emojiBurritoRegex);
    
    if (emojiMatches && emojiMatches.length > 0) {
      // Look for a name in the message
      const nameInMessage = userMessage.match(/(?:for|to|@)\s+([a-zA-Z0-9\s_-]+?)(?:\s|$|!|\.|,)/i);
      const nameAtEnd = userMessage.match(/([a-zA-Z0-9\s_-]+?)\s*🌯/i);
      const nameAtStart = userMessage.match(/^([a-zA-Z0-9\s_-]+?)\s/i);
      
      let recipientName = '';
      if (nameInMessage) {
        recipientName = nameInMessage[1].trim();
      } else if (nameAtEnd) {
        recipientName = nameAtEnd[1].trim();
      } else if (nameAtStart && !userMessage.startsWith('give') && !userMessage.startsWith('award') && !userMessage.startsWith('grant')) {
        recipientName = nameAtStart[1].trim();
      }
      
      // Only proceed if we found a name and it's not a common word
      const commonWords = ['great', 'good', 'nice', 'awesome', 'amazing', 'excellent', 'well', 'done', 'work', 'job', 'thanks', 'thank', 'you'];
      if (recipientName && recipientName.length > 1 && !commonWords.includes(recipientName.toLowerCase())) {
        const burritosToAward = emojiMatches.length;
        const recipientId = `demo-user-${recipientName.toLowerCase().replace(/\s+/g, '-')}`;
        
        // Prevent self-awarding by name
        if (recipientName.toLowerCase() === userName.toLowerCase()) {
          await send('🚫 Nice try, but you can\'t give yourself burritos!');
          return;
        }
        
        // Award multiple burritos based on emoji count
        for (let i = 0; i < burritosToAward; i++) {
          const award = awardBurrito(conversationData, recipientId, recipientName, userId, userName, 'emoji award');
        }
        saveConversationData(conversationData);
        
        const chatType = isGroupChat ? 'group chat' : 'personal chat';
        await send(`🌯 Emoji burrito award in ${chatType}! ${recipientName} received ${burritosToAward} burrito${burritosToAward !== 1 ? 's' : ''} from ${userName} (${burritosToAward} 🌯 emoji${burritosToAward !== 1 ? 's' : ''}!)`);
        
        // Show recipient's total
        const recipientStats = conversationData.userStats.get(recipientId);
        if (recipientStats) {
          await send(`🏆 ${recipientName} now has ${recipientStats.totalReceived} burrito${recipientStats.totalReceived !== 1 ? 's' : ''}!`);
        }
        
        return;
      }
    }
    
    // Check for burrito count requests (works in both group and personal chat)
    if (userMessage.includes('my burritos') || userMessage.includes('burrito count')) {
      const userStats = conversationData.userStats.get(userId);
      if (userStats) {
        await send(`🌯 ${userName}, you have received ${userStats.totalReceived} burrito${userStats.totalReceived !== 1 ? 's' : ''} and given ${userStats.totalGiven} burrito${userStats.totalGiven !== 1 ? 's' : ''}!`);
      } else {
        await send(`🌯 ${userName}, you haven't received any burritos yet! Keep up the good work! 💪`);
      }
      return;
    }
    
    // Show leaderboard (works in both group and personal chat)
    if (userMessage.includes('burrito leaderboard') || userMessage.includes('top burritos')) {
      await showLeaderboard(conversationData, send);
      return;
    }
    
    // Help command - works in all contexts
    if (userMessage.includes('help') || userMessage.includes('what can you do')) {
      let helpMessage = '';
      
      if (isGroupChat) {
        helpMessage = `🤖 **Burrito Bot Commands:**\n\n**Awarding Burritos:**\n• "give @username a burrito" - Award with @mention\n• "give John a burrito" - Award by name\n• "give Sarah a burrito 🌯🌯🌯" - Multiple burritos with emojis!\n• "Great work Mike! 🌯🌯" - Emoji-only awards\n• "give Sarah a burrito for great work" - Award with reason\n\n**Stats:**\n• "my burritos" - See your burrito count\n• "burrito leaderboard" - See top burrito earners\n\n**Admin Commands:**\n• "/admin report daily/weekly/monthly/yearly" - Get reports\n• "/admin stats @username" - Get user stats\n• "/admin leaderboard" - Show leaderboard\n\n🌯 More emojis = more burritos!`;
      } else {
        helpMessage = `🤖 **Burrito Bot - Personal Chat:**\n\n**Awarding Burritos:**\n• "give John a burrito" - Award by name\n• "give Sarah a burrito 🌯🌯🌯" - Multiple burritos with emojis!\n• "Amazing work Alice! 🌯🌯" - Emoji-only awards\n• "give Mike a burrito for excellent work" - Award with reason\n\n**Stats & Info:**\n• "my burritos" - Check your burrito count\n• "burrito leaderboard" - See top burrito earners\n• "/makeadmin" - Become an admin\n• "/debug" - Show debug info\n\n**Admin Commands:**\n• "/admin report daily/weekly/monthly/yearly" - Get reports\n• "/admin stats username" - Get user stats\n• "/admin leaderboard" - Show leaderboard\n\n🌯 More emojis = more burritos!`;
      }
      
      // Add admin status info if user is admin
      if (isAdmin(userId, conversationData)) {
        helpMessage += `\n\n👑 **You are an admin!** You can use all admin commands.`;
      }
      
      await send(helpMessage);
      return;
    }
    
    // Also respond to general "help" without group chat restriction
    if (userMessage === 'help' || userMessage === 'commands') {
      const generalHelp = `🌯 **Burrito Bot Help:**\n\n**Basic Commands:**\n• "hello" - Greet the bot\n• "help" - Show this message\n\n**Awarding Burritos:**\n• "give John a burrito" - Award by name (works everywhere!)\n• "give @username a burrito" - Award by mention (group chats)\n• "give Sarah a burrito 🌯🌯🌯" - Multiple burritos with emojis!\n• "Great job Mike! 🌯🌯" - Emoji-only burrito awards\n• "give Sarah a burrito for great work" - Award with reason\n\n**Stats:**\n• "my burritos" - Check your count\n• "burrito leaderboard" - See rankings\n\n**Admin Commands:**\n• "/admin report daily" - Get reports\n• "/admin stats username" - User stats\n\n🤖 **Chat Type:** ${isGroupChat ? 'Group Chat' : 'Personal Chat'}\n👑 **Admin Status:** ${isAdmin(userId, conversationData) ? 'Yes' : 'No'}\n\n💡 **Pro Tip:** More 🌯 emojis = more burritos awarded!`;
      
      await send(generalHelp);
      return;
    }
    
    // Greeting responses
    if (userMessage.includes('hello') || userMessage.includes('hi') || userMessage.includes('hey')) {
      const greeting = isGroupChat 
        ? '🌯 Hello! I\'m here to help track burritos in your team. Say "help" to see what I can do!'
        : '🌯 Hello! Add me to a group chat to start tracking burritos for your team!';
      await send(greeting);
      return;
    }
    
    // Default response
    const defaultMessage = isGroupChat 
      ? '🌯 Try saying "help" to see what I can do, or give burritos: "give John a burrito", "give @user a burrito", or "Great work Sarah! 🌯🌯🌯"!'
      : '🌯 **Personal Chat Commands:**\n• "give John a burrito" - Award burritos by name!\n• "give Alice a burrito 🌯🌯🌯" - Multiple burritos with emojis!\n• "Amazing work Bob! 🌯🌯" - Emoji-only awards\n• "help" - Show all commands\n• "my burritos" - Check your stats\n• "burrito leaderboard" - See rankings\n• "/makeadmin" - Become admin\n\n🎉 **More 🌯 emojis = more burritos!**';
    
    await send(defaultMessage);
    
  } catch (error) {
    console.error(error);
    await send("Sorry, I encountered an error. Please try again!");
  }
});

// Handle when members are added to set up initial admin
app.on('conversationUpdate', async ({ send, activity }) => {
  if (activity.membersAdded && activity.membersAdded.length > 0) {
    const conversationId = activity.conversation.id;
    const conversationData = await getConversationData(conversationId);
    
    // If this is the first time the bot is added and no admins exist
    if (conversationData.admins.length === 0 && activity.conversation.isGroup) {
      // The person who added the bot becomes the first admin
      const addedBy = activity.from?.id;
      if (addedBy) {
        conversationData.admins.push(addedBy);
        await saveConversationData(conversationData);
      }
      
      await send('🌯 **Welcome to Burrito Bot!** 🌯\n\nI\'m here to help track burritos in your team! Here\'s how to get started:\n\n**Award Burritos:**\n• Type: "give @username a burrito"\n• Add a reason: "give @username a burrito for great work!"\n\n**Check Stats:**\n• "my burritos" - See your burrito count\n• "burrito leaderboard" - See top earners\n\n**Admin Features:**\n• `/admin report daily/weekly/monthly/yearly`\n• `/admin stats @username`\n\nStart recognizing great work with burritos! 🎉');
    }
  }
});

export default app;