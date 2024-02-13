import { Client, ClientArray, Room } from 'colyseus';
import { Schema, type, ArraySchema, MapSchema } from '@colyseus/schema';
import { log } from 'console';
import { nextTick } from 'process';

class Player extends Schema {
  @type('string') userId: string;
  @type('string') name: string;
  @type('number') speedStick?: number = 200;
  @type('number') index?: number;
  @type('number') score?: number = 0;

  @type('number') stickMinAt?: number; // reset
}

class Ground extends Schema {
  @type('number') index: number;
  @type('number') space: number;
  @type('number') width: number;
}

class RoomState extends Schema {
  @type([Ground]) worldMap = new ArraySchema<Ground>();
  @type({ map: Player }) players = new MapSchema<Player>();
  mapLength = 10; // số ô đất trong 1 map

  minStickLength = 0; // độ dài que
  maxStickLength = 1000;

  minGroundWidth = 50; // chiều rộng ô
  maxGroundWidth = 140;

  minSpace = 150; // khoảng các giữa các ô
  maxSpace = 400;

  genMap() {
    for (let index = 0; index < this.mapLength; index++) {
      const groud = new Ground();

      const width =
        Math.floor(
          Math.random() * (this.maxGroundWidth - this.minGroundWidth + 1),
        ) + this.minGroundWidth;

      const space =
        Math.floor(Math.random() * (this.maxSpace - this.minSpace + 1)) +
        this.minSpace;

      groud.index = index;
      groud.space = space;
      groud.width = width;
      this.worldMap.push(groud);
    }
  }

  setPlayer(data: Player) {
    const player = new Player();
    player.userId = data.userId;
    player.name = data.name;
    player.index = Math.floor(Math.random() * (this.mapLength - 4 - 4 + 1)) + 4;
    // player.index = Math.floor(Math.random() * (this.mapLength - 3 - 2 + 1)) + 2;
    player.speedStick = 200;
    player.score = 0;
    this.players.set(player.userId, player);
    return player;
  }

  getPlayer(userId: string) {
    return this.players.get(userId);
  }

  removePlayer(userId: string) {
    this.players.delete(userId);
  }
}

export class StickHeroRoom extends Room<RoomState> {
  onCreate(options) {
    this.maxClients = 10;
    console.log(this.maxClients);

    console.log('created room', this.roomId);
    const roomState = new RoomState();
    this.setState(roomState);
    roomState.genMap();

    this.onMessage('play-again', (client, message) => {
      const player = this.state.players.get(client.userData.userId);
      this.state.players.delete(client.userData.userId);
      this.state.setPlayer(player);
      this.broadcast('play-again', player);
      // client.send('playerGain');
    });

    this.onMessage('startTouch', (client, message) => {
      this.broadcast('startTouch', client.userData.userId, { except: client });
    });

    this.onMessage('endTouch', (client, message) => {
      this.broadcast('otherPlayerEndTouch', client.userData.userId, {
        except: client,
      });
      this.checkPlayerMove(client, message.totalDt);
    });
  }

  onJoin(client: Client, options) {
    console.log('onJoin', this.roomId);
    const token = options.token;
    const userId = options.userId;
    // check token
    const playerData = {
      userId: options.userId,
      name: this.randomName(),
    };

    client.userData = {
      userId: userId,
      playerData: JSON.stringify(playerData),
    };

    client.send('gamedata', {
      success: true,
      data: {
        map: this.state.worldMap,
        config: {
          minStickLength: this.state.minStickLength,
          maxStickLength: this.state.maxStickLength,
          mapLength: this.state.mapLength,
        },
      },
    });
    this.state.setPlayer(JSON.parse(client.userData.playerData) as Player);
  }

  onLeave(client: Client) {
    this.state.removePlayer(client.userData.userId);
  }

  checkPlayerMove(client: Client, dt: number) {
    const player = this.state.players.get(client.userData.userId);
    let nowGround, nextGround;
    const nextIndex =
      (player.index + 1 + this.state.worldMap.length) %
      this.state.worldMap.length; // +1 quay đầu

    // get 2 land now and next
    for (const item of this.state.worldMap.toArray()) {
      if (item.index === player.index) nowGround = item;
      else if (item.index === nextIndex) nextGround = item;
      if (nextGround && nowGround) {
        break;
      }
    }

    // tính stick height từ dt
    let stickHeight = this.state.minStickLength + player.speedStick * dt;
    if (stickHeight >= this.state.maxStickLength)
      stickHeight = this.state.maxStickLength;
    console.log(
      'stickHeight: ',
      stickHeight,
      nowGround.space + 5,
      nowGround.space + nextGround.width + 5,
    );

    /////////////////////

    let body = {
      success: false,
      data: {
        action: '',
        userId: client.userData.userId,
        stickHeight: 0,
        player: {},
      },
    };
    body.data.stickHeight = stickHeight;
    // mấy cái que thụt vô lề 5
    // stickHeight = nowGround.space + 10; // FOR TEST, this stick alway success
    if (stickHeight < nowGround.space + 5) {
      body.success = false;
      body.data.action = 'stickBreaking';
      player.score = 0;
      player.index =
        Math.floor(Math.random() * (this.state.mapLength - 3 - 2 + 1)) + 2;
    } else if (stickHeight > nowGround.space + nextGround.width + 5) {
      body.success = false;
      body.data.action = 'moveOverflow';

      player.score = 0;
      player.index =
        Math.floor(Math.random() * (this.state.mapLength - 3 - 2 + 1)) + 2;
    } else {
      player.score++;
      if (player.score % 5 == 0) player.speedStick += 50;

      player.index = nextIndex;
      body.success = true;
      body.data.action = 'moveNext';
    }
    body.data.player = player.toJSON();
    this.broadcast('playerMove', body);
  }

  randomString(length: number): string {
    const characters =
      'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let randomString = '';
    for (let i = 0; i < length; i++) {
      const randomIndex = Math.floor(Math.random() * characters.length);
      const randomChar = characters.charAt(randomIndex);
      randomString += randomChar;
    }
    return randomString;
  }

  randomName() {
    const myArray = [
      'Trần Hạo Nam',
      'langtu_datinh123',
      'gay lord',
      'c0_b3_nG0k_199x',
      'nhok_trumzz',
      'chảo chống dính',
      'keo dính chuột',
      'Quái_Thú',
      'Cumming',
      'Mr.Peats',
      'sói đồng cỏ',
      'Chang_Kho_9x',
      'Ca sĩ Hàn Quốc',
      'MTP_TùngSơn',
      'Q_Kun_yellow',
      'traitimcodon',
      'ZzcongchuabongbongzZ',
    ];

    const randomIndex = Math.floor(Math.random() * myArray.length);
    return myArray[randomIndex];
  }
}
